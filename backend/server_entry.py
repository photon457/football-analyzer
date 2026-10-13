"""
Standalone Entrypoint for Frozen Python Analysis Backend Service.
Designed for PyInstaller bundling to run on target systems without Python.
"""

import os
import sys
import multiprocessing

# Add repository root to Python path
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

# Handle PyInstaller temporary directory sys._MEIPASS
if hasattr(sys, '_MEIPASS'):
    if sys._MEIPASS not in sys.path:
        sys.path.insert(0, sys._MEIPASS)

import uvicorn
from backend.api.main import app

def main():
    multiprocessing.freeze_support()
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "127.0.0.1")
    print(f"Starting Football Analysis Backend on {host}:{port}...")
    uvicorn.run(app, host=host, port=port, log_level="info")

if __name__ == "__main__":
    main()
