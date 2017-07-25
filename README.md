## Repo Explorer

Visualizes git repositories as timelines.

See it live [here](http://sakunlabs.com/repoexplorer) and [this](http://sakunlabs.com/blog/post/repo-explorer/) blog post.

### Set up the environment

- Install front-end dependencies: `npm install`
- Install backend dependencies (assuming you have `virtualenv` with 3.6 installed):
    - `virtualenv venv`
    - `source venv/bin/activate`
    - `pip install -r requirements.txt`

### Run

- Run webpack: `webpack --progress --watch` (compiles JavaScript & CSS)
- Separately, run the webserver: `python run.py`
- Then navigate to [http://127.0.0.1:5000/repoexplorer](http://127.0.0.1:5000/repoexplorer)

### Importing a repository

Since the visualization depends upon a fair bit of processing to extract information from repositories, you would need to "import" one before you can visualize it.
The process is manual right now:

- Clone a respository somewhere locally
- `source venv/bin/activate`
- launch the REPL: `bpython`
- set up the library: `from gitviz.git import git`
- import your repository: `git.importRepo('/path/to/your/locally/cloned/repository')`

This should add the processed JSON to `gitviz/data/`, and be available if you refresh the app in the browser.
