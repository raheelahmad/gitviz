import pygit2
from datetime import datetime, timezone, timedelta

def time_from_commit(commit: pygit2.Commit):
    tzinfo = timezone(timedelta(minutes=commit.author.offset))
    dt = datetime.fromtimestamp(float(commit.author.time), tzinfo)
    return dt

def time_string_from_commit(commit: pygit2.Commit):
    
    return time_from_commit(commit).isoformat()
