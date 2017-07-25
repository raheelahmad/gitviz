## Repo Explorer

Visualizes git repositories as timelines.

### Set up the environment

- Install front-end dependencies: `npm install`
- Install backend dependencies (assuming you have `virtualenv` installed):
    - `source venv/bin/activate`
    - `pip install -r requirements.txt`

### Run

- Run webpack: `webpack --progress --watch` (compiles JavaScript & CSS)
- Separately, run the webserver: `python run.py`

### Importing a repository

Since the visualization depends upon a fair bit of processing to extract information from repositories, you would need to "import" one before you can visualize it.
The process is manual right now:

- Clone a respository somewhere locally
- `source venv/bin/activate`
- launch the REPL: `bpython`
- set up the library: `from gitviz.git import git`
- import your repository: `git.importRepo('/path/to/your/locally/cloned/repository')`

This should add the processed JSON to `gitviz/data/`, and be available if you refresh the app in the browser.
