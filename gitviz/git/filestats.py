import os
from subprocess import check_output, STDOUT
import stat
import pathlib
import pygit2
import re
from enum import Enum
from . import formatters


def shell_output(command):
    """Returns the shell output of the string command"""
    return check_output(command, shell=True).decode('utf-8', 'ignore')


def maxfilestats(reponame, maxFileCount):
    """Returns commit stats for files with most commits"""
    maxCommitFilesCommand = "cd {}; git rev-list --objects --all | awk '$2' |\
    sort -k2 | uniq -cf1 | sort -rn".format(reponame)
    result_string = shell_output(maxCommitFilesCommand)

    # each line is of the form "[num_commits] [sha] [file/folder path]"
    stat_lines = str.split(result_string, sep="\n")
    topstats = dict()  # (key: file, value: [{insertions, deletions, commit}])
    for filestat in stat_lines:
        # For later: should instead check if the file extension is
        # of one of the languages defined for this repo in GitHub API
        if shouldIncludeStatObject(filestat) is True:
            file = pathFromItemLine(filestat)
            topstats[file] = commits_for_filestat(file, reponame)
        if len(topstats) >= maxFileCount:
            break

    # for files whose stats are included in renames;
    # will be removed from topstats later
    files_accounted_in_renames = set()

    def statsForFile(file):
        """Returns stats from topstats or fetches them from repo"""
        if file in topstats:  # if we already have the commits
            return topstats[file]
        else:
            return commits_for_filestat(file, reponame)

    def extend_stats(to_file, to_stats, from_file, from_stats, direction):
        """Add the stats from from_file to those of to_file"""
        if len(from_stats) == 0:
            return
        files_accounted_in_renames.add(from_file)
        for commit_info in from_stats:
            commit_info['file'] = to_file
        if direction == WalkDirection.BACK_IN_TIME:
            # add at the end
            to_stats[-1:] = from_stats
        elif direction == WalkDirection.FORWARD_IN_TIME:
            # add at the beginning; skip duplicate
            if from_stats[-1]['commit'].oid == to_stats[0]['commit'].oid:
                from_stats = from_stats[:-1]
            to_stats[:0] = from_stats

    def renamed_to(filepath, original=None, direction=None):
        """Finds out if this file renamed to (in latest commit)
        or renamed from (in its earliest commit)?

        If it was renamed, the filepath's stats are extended
        by those of the file found.

        @param filepath the file to find renaming for
        @param original if provided, its stats are extended
                        instead of filepath's
        @param direction if provided, renaming is searched in this direction.
                         Otherwise either direction is considered.
        """
        stats = statsForFile(filepath)

        last_commit = stats[0]['commit']
        earliest_commit = stats[-1]['commit']

        renamed_from_file = None
        renamed_to_file = None

        if direction == WalkDirection.BACK_IN_TIME:
            renamed_from_file = fileRenamedFromAnother(filepath,
                                                       earliest_commit,
                                                       reponame)
            if not renamed_from_file:
                return None, None
        elif direction == WalkDirection.FORWARD_IN_TIME:
            renamed_to_file = fileRenamedToAnother(filepath,
                                                   last_commit,
                                                   reponame)
            if not renamed_to_file:
                return None, None
        else:
            renamed_from_file = fileRenamedFromAnother(filepath,
                                                       earliest_commit,
                                                       reponame)
            renamed_to_file = fileRenamedToAnother(filepath,
                                                   last_commit,
                                                   reponame)

        if renamed_from_file:
            # don't take the first commit as it will be
            # the same as filepath's last
            renamed_from_file_stats = statsForFile(renamed_from_file)
            to_file = original if original else filepath
            to_stats = statsForFile(to_file)
            extend_stats(to_file, to_stats, renamed_from_file,
                         renamed_from_file_stats, WalkDirection.BACK_IN_TIME)
            return renamed_from_file, WalkDirection.BACK_IN_TIME
        elif renamed_to_file:
            # don't take the last commit as it will be the
            # same as filepath's first
            renamed_to_stats = statsForFile(renamed_to_file)
            from_file = original if original else filepath
            from_stats = statsForFile(from_file)
            extend_stats(from_file, from_stats, renamed_to_file,
                         renamed_to_stats, WalkDirection.FORWARD_IN_TIME)
            return renamed_to_file, WalkDirection.FORWARD_IN_TIME
        else:
            return None, None

    class WalkDirection(Enum):
        """The temporal direction of commits"""
        BACK_IN_TIME = 1
        FORWARD_IN_TIME = 2

    # Process renamings:
    # if any of the files has been renamed or has come from a rename,
    # add stats for renames
    for f in topstats:
        if f in files_accounted_in_renames:
            continue
        renamed_file, direction = renamed_to(f)
        if not renamed_file:
            continue

        # find all renames in this direction
        while renamed_file:
            renamed_file, _ = renamed_to(renamed_file,
                                         original=f,
                                         direction=direction)

        # find all renames for f in the original direction
        opposite_direction = WalkDirection.BACK_IN_TIME if direction == WalkDirection.FORWARD_IN_TIME else WalkDirection.FORWARD_IN_TIME
        renamed_file, _ = renamed_to(f, direction=opposite_direction)
        while renamed_file:
            renamed_file, _ = renamed_to(renamed_file, original=f, direction=opposite_direction)

    for new_file in files_accounted_in_renames:
        if new_file in topstats:
            del topstats[new_file]

    return topstats

def commits_for_filestat(filepath, reponame):
    repo = pygit2.Repository(reponame)
    # do full history search to include deleted files
    commits_command = "cd {}; git log --stat --summary --all --full-history -- \"{}\"".format(reponame, filepath)
    commit_log_lines = shell_output(commits_command).split('\n')
    stats = []
    current_commit = None
    current_renamed_from_file_file = None
    # commit_log_lines from `log --stat` is in the long log form, so we iterate
    # to parse the stat
    for line in commit_log_lines:
        # wait until we are under a commit
        if current_commit:
            stats_match = stat_from_long_log(line)
            # is the current line a stat line?
            if stats_match:
                stats_match['file'] = filepath
                stats_match['commit'] = repo.get(current_commit)
                stats.append(stats_match)
                current_commit = None
        else:
            current_commit = commit_from_long_log(line)

    return stats


# -- Helpers

def fileRenamedInCommit(filepath, commit, reponame, to=True):
    """
    If to    => what was filepath renamed *to*,
    If false => what was filepath renamed *from*
    """
    if isFirstCommit(commit.oid, reponame): return None
    commitId = str(commit.oid)
    res = shell_output('cd {}; git config diff.renameLimit 999999; git diff --name-status {} {}~'.format(reponame, commitId, commitId)).split('\n')
    for line in res:
        rename_match = re.search("^R([0-9]+)\t(.*)\t(.*)", line)
        if rename_match and len(rename_match.groups()) == 3:
            if to and rename_match.group(3) == filepath:
                return rename_match.group(2)
            elif (not to) and rename_match.group(2) == filepath:
                return rename_match.group(3)

def fileRenamedToAnother(filepath, commit, reponame):
    """
    Was the file renamed to another file in this commit
    """
    return fileRenamedInCommit(filepath, commit, reponame, to=True)

def fileRenamedFromAnother(filepath, commit, reponame):
    """
    Was the file renamed from another file in this commit
    """
    return fileRenamedInCommit(filepath, commit, reponame, to=False)

def isFirstCommit(commitSha, reponame):
    """
    Does the SHA belong to the first commit in the repo?
    """
    repo = pygit2.Repository(reponame)
    commit = repo.get(commitSha)
    return len(commit.parents) == 0

def pathFromItemLine(filestat):
    """Get the path from a filestat"""
    # join since the split will split into mode, sha, and file path components separated by spaces
    return " ".join(filestat.split()[2:])

def shouldIncludeStatObject(filestat):
    """Currently: is it a file, and is it one of the known source file extension"""
    if not isStatObjectAFile(filestat): return False
    itempath = pathFromItemLine(filestat)
    extension = pathlib.Path(itempath).suffix.split('.')[1] # suffix gives '.py'
    if extension in known_extensions:
        return True
    else:
        return False

def isStatObjectAFile(filestat):
    itemsplit = filestat.split()
    if len(itemsplit) < 3: return False
    itempath = pathFromItemLine(filestat)
    extension_split = pathlib.Path(itempath).suffix.split('.')
    if len(extension_split) == 2:
        return True
    else:
        return False

known_extensions = [
    "m", "cc", "cpp", "mm", "h", "c", "swift",
    "py", "rb", "js", "json", "html", "txt",
    "go", "rs",
    "clj", "cljs",
    "md", "rst", "yml", "erb", "scss"
]

def stat_from_long_log(line):
    stat_line_match = re.search(r"^\s+1 file changed, (([0-9]+) insertion(s)?\(\+\))?(, )?(([0-9]+) deletion(s)?\(\-\))?$", line)
    if not stat_line_match: return None
    if len(stat_line_match.groups()) == 7:
        res = {}
        insertions, deletions = stat_line_match.group(2), stat_line_match.group(6)
        if insertions: res['insertions'] = int(insertions)
        if deletions: res['deletions'] = int(deletions)
        return res
    else: return None

def commit_from_long_log(line):
    commit_line_match = re.search(r'^(commit) ([a-f0-9]+)$', line)
    if not commit_line_match: return None
    if len(commit_line_match.groups()) == 2:
        return commit_line_match.group(2)
    return None

# ---

def shouldSkipFileFromStats(reponame, resline):
    """WIP: tried to exclude directories. Seems to include some of them still"""
    itemsplit = resline.split()
    if len(itemsplit) != 3: return True
    itempath = itemsplit[2]
    path = os.path.join(reponame, itempath)
    if os.path.exists(path):
        mode = os.stat(path)[stat.ST_MODE]
        return stat.S_ISDIR(mode)
    else:
        deleted_find_command = "cd {}; git log --diff-filter=D --summary | grep {}".format(reponame, itempath)
        try:
            deleted_find_result = check_output(deleted_find_command, stderr=STDOUT, shell=True)
            delete_mode = deleted_find_result.split()[2]
            deleted_mode_is_dir = delete_mode == "040000"
            return deleted_mode_is_dir
        except Exception as err:
            print("EXCPTN: {}".format(err))
            return True

