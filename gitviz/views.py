from flask import render_template, request, session

import pathlib
import datetime
import json
import glob

from gitviz.git import git
from gitviz import app


def allRepoNames():
    jsonsDirPath = pathlib.Path.cwd().joinpath('gitviz/data/')
    names = [jsonFile.stem for jsonFile in sorted(jsonsDirPath.glob("*.json"))]
    return names


def reponame():
    """Current repo's name"""
    return repo().split('/')[-1 ]

def repo():
    """Current repo, set in session"""
    if not 'repo' in session:
        session['repo'] = allRepoNames()[0]
    return session['repo']


def set_repo(new_repo):
    repos = allRepoNames()
    if new_repo in repos:
        session['repo'] = new_repo
        # move choice to index 0
        new_index = repos.index(new_repo)
        repos[new_index], repos[0] = repos[0], repos[new_index]
    else:
        print('ERR: no such repo: {}'.format(new_repo))

@app.errorhandler(404)
def page_not_found(e):
    print(dir(request))
    return "WHAT"

@app.route('/repoexplorer/')
def index():
    # if we need to get JSON
    # (accessed via D3 code, after the intial HTML render)
    repoToGet = request.args.get('get_repo')
    if repoToGet:
        dataPath = pathlib.Path.cwd().joinpath('gitviz/data/').joinpath(repo() + '.json')
        repoJson = dataPath.read_text()
        return json.dumps({
            'data': json.loads(repoJson)
        })

    # if we are asked to return the initial HTML page
    repoToSet = request.args.get('set_repo')
    if repoToSet:
        set_repo(repoToSet)
    repos = [{'name': repo,
              'selected': repo == reponame()}
             for repo in allRepoNames()]
    return render_template('/index.html',
                           repo_name=reponame(),
                           repos=repos)

# --------- UNUSED ---------

@app.route('/vizdata')
def vizdata():
    dataPath = pathlib.Path.cwd().joinpath('gitviz/data/').joinpath(reponame() + '.json')
    accesstime = dataPath.stat().st_mtime
    date = datetime.datetime.fromtimestamp(accesstime)
    repoJson = dataPath.read_text()
    return json.dumps({
        'source': 'cache',
        'cached_time': date.isoformat(),
        'data': json.loads(repoJson)
    })


@app.route('/data')
def data():
    # whether explicitly asked to reload from repo instead of cache
    cachedPath = pathlib.Path.cwd().joinpath('gitviz/data/').joinpath(reponame()+ '.json')
    if cachedPath.exists():
        accesstime = cachedPath.stat().st_mtime
        date = datetime.datetime.fromtimestamp(accesstime)
        repoJson = cachedPath.read_text()
        return json.dumps({
            'source': 'cache',
            'cached_time': date.isoformat(),
            'data': json.loads(repoJson)
        })
    else:
        repoJson = git.analyze(repo())
        print('-- loaded from repo {}'.format(repo()))
        cachedPath.write_text(repoJson)
        return json.dumps({
            'source': 'repo',
            'data': json.loads(repoJson)
        })
