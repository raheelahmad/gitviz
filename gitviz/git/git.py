import sys
import pygit2
import json
import math
import time
import os
import pathlib
from bisect import insort_left
from datetime import datetime, timezone, timedelta

from . import author
from . import filestats
from . import formatters

def localDayMinutes(commit_time):
    return 60*commit_time.hour+commit_time.minute # minutes elasped in the day at commit time


def localWeekMinutes(commit_time: datetime.date, shouldPrint = False):
    weekday = commit_time.weekday()
    minutes_before_today = weekday * (60*24)
    minutes_today = localDayMinutes(commit_time)
    result = minutes_today + minutes_before_today
    if shouldPrint:
        print('weekday: {}, minutes_before_today: {}, minutes_today: {}'.format(weekday, minutes_before_today, minutes_today))
    return result

def importRepo(repopath):
    reponame = repopath.split('/')[-1]
    cachedPath = pathlib.Path.cwd().joinpath('gitviz/data/').joinpath(reponame + '.json')
    repoJson = analyze(repopath)
    cachedPath.write_text(repoJson)

def analyze(reponame):
    repo = pygit2.init_repository(reponame)
    count = 0
    authors = []
    times = []
    commits = []
    insertions = []
    deletions = []
    start_time = time.time()

    def commit_info_from_commit(commit: pygit2.Commit, trackTime = True):
        """Internal method to convert a Commit to its dict representation"""
        if should_include(commit) == False: return
        author_info: AuthorsInfo = author.add_author(authors, commit, count)
        commit_time = formatters.time_from_commit(commit)
        commit_info = {
            'message': commit.message.split('\n')[0],
            'name': author_info.name(),
            'sha': str(commit.oid),
            'email': author_info.email(),
            'time': commit_time.isoformat(),
            'local_day_minutes': localDayMinutes(commit_time),
            'local_weekday_minutes': localWeekMinutes(commit_time)
        }
        ins, dels = 0, 0  # defaults if there are no parents (original commit)
        if len(commit.parents) > 0:
            stats = repo.diff(commit.parents[0], commit).stats
            ins = stats.insertions
            dels = stats.deletions
            insertions.append(ins)
            deletions.append(dels)
        commit_info['insertions'] = ins
        commit_info['deletions'] = dels
        if trackTime:
            insort_left(times, commit_time.isoformat())
            if count == 1:
                initial_time = commit_time
        return commit_info

    # Process all commits
    for commit in repo.walk(repo.head.target, pygit2.GIT_SORT_TIME):
        count += 1
        commit_info = commit_info_from_commit(commit)
        if commit_info is None:
            continue
        commits.append(commit_info)
        # if commit length needs to be trimmed...
        # max_days = 288
        # days_delta = (initial_time - commit_time).days
        # if days_delta > max_days:
        #     break
    # sort commits and authors
    sorted_commits = sorted(commits, key=lambda commit: commit['time'], reverse=True)
    sorted_authors = sorted(authors, key=lambda author: len(author.commit_indices))
    # split up authors into high committers, and a group of small committers
    strategy = author.LowCommitAuthorsStrategy.BY_LOW_COMMITTERS_COUNT
    (author_desc, low_commit_author_desc) = author.split_authors(sorted_commits, sorted_authors, strategy)

    # files with most commits
    maxfilecommits = filestats.maxfilestats(reponame, 15) # dict with key as filename, and value is commit detail
    maxfileJSONlist = []

    # like insertions, deletions; but for file stats
    # these are not for a commit, but for the given file in a commit
    file_insertions, file_deletions = [], []

    def commit_index(sha):
        for idx, commit in enumerate(sorted_commits):
            if commit['sha'] == sha:
                return idx

    for file in maxfilecommits:
        commitDetails = maxfilecommits[file]
        detailsToRemove = []  # these commit details could not be JSONified (merge commit probably)
        fileAuthors = set()
        # keys are insertions, deletions, commit
        for idx, detail in enumerate(commitDetails):
            if 'commit_index' in detail:
                print('skipping!')
                continue
            pygitCommit = detail['commit']
            # probably a coding error in maxfilestats(), but sometimes this could be a dict instead
            if not type(pygitCommit) is dict:
                sha = str(pygitCommit.oid)
            else:
                sha = pygitCommit['sha']
            index = commit_index(sha)
            if index:
                del detail['commit']
                commit = sorted_commits[index]
                detail['commit_index'] = index
                if 'insertions' in detail:
                    file_insertions.append(detail['insertions'])
                if 'deletions' in detail:
                    file_deletions.append(detail['deletions'])

                authorEmail = commit['email']
                authorName = commit['name']
                matching_authors = [author for author in authors if author.is_commit_author(authorName, authorEmail)]

                if len(matching_authors) > 0:
                    fileAuthors.add(matching_authors[0])
            else:
                detailsToRemove.append(idx)
        commitDetails = [detail for idx, detail in enumerate(commitDetails) if idx not in detailsToRemove]
        sortedFileAuthors = sorted(fileAuthors, key=lambda author: len(author.commit_indices), reverse=True)
        maxfileJSONlist.append({
            'file': file,
            'commits': commitDetails,
            'authors': [author.description() for author in sortedFileAuthors]
        })
        print('{}\'s authors: {}'.format(file, [a.name() for a in fileAuthors]))

    response_dict = {
        'commits': sorted_commits,
        'authors': author_desc,
        'low_commit_authors': low_commit_author_desc,
        'time_extent': [times[0], times[len(times)-1]],
        'times': times,
        'line_stats': percentile_stat_info(insertions, deletions),
        'filestats_line_stats': percentile_stat_info(file_insertions, file_deletions),
        'files_with_max_commits': maxfileJSONlist
    }
    response_json = json.dumps(response_dict, indent=2)

    # log the time taken to analyze
    end_time = time.time()
    print('-- Time to analyze {}: {}'.format(reponame.split('/')[-1], (end_time-start_time)))
    return response_json

def percentile_stat_info(insertions, deletions):
    values = insertions + deletions
    sorted_values = sorted(values)
    percentile = 0.99
    percentile_index = math.floor(float(len(sorted_values) * percentile))
    if percentile_index > len(sorted_values)-4: percentile_index -= 1
    percentile_value = sorted_values[percentile_index]
    return {'min': min(sorted_values), 'max': max(sorted_values), 'percentile_value': percentile_value }


def should_include(commit):
    """Currently, excludes merge commits"""
    if len(commit.parents) > 1:
        return False

if __name__ == '__main__':
    analyze(sys.argv[1])
