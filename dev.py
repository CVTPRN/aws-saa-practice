"""Local development server; production uses Gunicorn."""
import argparse
import os
from app import create_app

parser = argparse.ArgumentParser()
parser.add_argument('--host', default='127.0.0.1')
parser.add_argument('--port', type=int, default=int(os.environ.get('PORT', 3000)))
parser.add_argument('--strictPort', action='store_true')
args = parser.parse_args()
create_app().run(host=args.host, port=args.port)
