from flask import Flask

app = Flask(__name__, instance_relative_config=True)

# load the views
from gitviz import views

app.config.from_object('config')
app.secret_key = 'AHKJHDK*$SJAJB92na'
# toolbar = DebugToolbarExtension(app)
