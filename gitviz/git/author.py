from enum import Enum

class AuthorsInfo:
    def email(self): return self.emails[0]
    def name(self): return self.names[0]
    def other_emails(self):
        return [e for e in self.emails if e != self.email()]
    def other_names(self):
        return [n for n in self.names if n != self.name()]

    def __init__(self, name, email, commit_index):
        self.names = [name]
        self.emails = [email]
        self.commit_indices = [commit_index]

    def is_commit_author(self, commitAuthorName, commitAuthorEmail):
        has_email = commitAuthorEmail in self.emails
        has_name = commitAuthorName in self.names
        return has_email or has_name

    def add_commit_author(self, commit, index):
        author = commit.author
        has_email = author.email in self.emails
        has_name = author.name in self.names
        if has_email or has_name:
            # only add if needed
            if not has_email:
                self.emails.append(author.email)
            if not has_name:
                self.names.append(author.name)
            self.commit_indices.append(index)
            return True
        return False

    def description(self):
        """Returns a dict representation"""
        return {
            'email': self.email(),
            'name': self.name(),
            'other_names': self.other_names(),
            'other_emails': self.other_emails(),
            'commits': self.commit_indices
        }

def add_author(authors_info, commit, index):
    for info in authors_info:
        if info.add_commit_author(commit, index):
            # if found, update & return
            return info
    # if not found, add it
    new_info = AuthorsInfo(commit.author.name, commit.author.email, index)
    authors_info.append(new_info)
    return new_info

class LowCommitAuthorsStrategy(Enum):
    BY_LOW_COMMITTERS_COUNT = 1 # lower x committers are separated from main (high commit) authors
    BY_PERCENTILE = 2

def split_authors(sorted_commits, sorted_authors, strategy: LowCommitAuthorsStrategy):
    author_sort = lambda auth: auth.commit_indices[0]

    if strategy is LowCommitAuthorsStrategy.BY_LOW_COMMITTERS_COUNT:
        max_count = 14
        main_authors = sorted(sorted_authors[-max_count:], key=author_sort)
        low_commit_authors = sorted(sorted_authors[:-max_count], key=author_sort)
    else:
        author_commits_counts = [len(x.commit_indices) for x in sorted_authors]
        author_commits_percentile = 0.1
        lower_percentile_index = math.floor(float(len(author_commits_counts) * author_commits_percentile))
        main_authors = sorted(sorted_authors[lower_percentile_index:], key= author_sort)
        low_commit_authors = sorted(sorted_authors[:lower_percentile_index], key=author_sort)

    author_descriptions = [x.description() for x in main_authors]
    low_commit_author_descriptions = [x.description() for x in low_commit_authors]
    # print('main authors: {}'.format([x.email() for x in main_authors]))
    # print('--- {} main authors'.format(len(main_authors)))
    # print('low commit authors: {}'.format([[x.email(), len(x.commit_indices)] for x in low_commit_authors]))
    # print('--- {} low commit authors'.format(len(low_commit_authors)))
    return (author_descriptions, low_commit_author_descriptions)
