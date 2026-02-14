#!/usr/bin/env python3
"""
Helper script to start a reading session from your backend.

This script provides a simple Python API to start the reading session
with story content from your database.

Usage from your backend:
    from start_reading_session import start_reading_session
    
    # Get story from your database
    story_content = get_story_from_db(session_id)
    
    # Start the reading session
    start_reading_session(story_content, session_id)
"""

import subprocess
import sys
import os


def start_reading_session(story_content: str, session_id: str = None, show_story: bool = False):
    """
    Start a reading session with the given story content.
    
    Args:
        story_content: The complete story text
        session_id: Optional session ID for tracking
        show_story: Whether to display the story before starting
    
    Returns:
        subprocess.Popen object for the running process
    """
    if not story_content or not story_content.strip():
        raise ValueError("Story content cannot be empty")
    
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    reader_script = os.path.join(script_dir, 'tagalog_story_reader.py')
    
    # Build command
    cmd = [sys.executable, reader_script, '--story-content', story_content]
    
    if show_story:
        cmd.append('--show-story')
    
    # Start the process
    print(f"🚀 Starting reading session...")
    if session_id:
        print(f"   Session ID: {session_id}")
    print(f"   Story length: {len(story_content)} characters")
    print()
    
    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        
        print(f"✅ Reading session started (PID: {process.pid})")
        return process
        
    except Exception as e:
        print(f"❌ Error starting reading session: {e}")
        raise


def start_reading_session_sync(story_content: str, session_id: str = None, show_story: bool = False):
    """
    Start a reading session and wait for it to complete (blocking).
    
    Args:
        story_content: The complete story text
        session_id: Optional session ID for tracking
        show_story: Whether to display the story before starting
    
    Returns:
        Return code from the process
    """
    process = start_reading_session(story_content, session_id, show_story)
    
    try:
        # Wait for process to complete
        return_code = process.wait()
        return return_code
    except KeyboardInterrupt:
        print("\n⚠️  Session interrupted by user")
        process.terminate()
        return -1


# Example usage
if __name__ == "__main__":
    # Example story
    example_story = """
Ang Aso sa Lungga

May isang aso na kumain ng karne. Pumunta siya sa ilog upang uminom ng tubig.
Habang naglalakad, nakita niya ang kanyang sarili sa tubig. Akala niya ay 
isa pang aso na may karne. Gusto niyang kunin ang karne ng ibang aso.
Nang buksan niya ang kanyang bibig, nahulog ang kanyang karne sa tubig.
Nawala ang kanyang pagkain dahil sa kanyang kasakiman.
    """
    
    print("=" * 70)
    print("  READING SESSION HELPER - EXAMPLE")
    print("=" * 70)
    print()
    print("This is an example of how to use this helper script.")
    print("In your backend, you would call:")
    print()
    print("  from start_reading_session import start_reading_session")
    print("  start_reading_session(story_content, session_id)")
    print()
    print("=" * 70)
    print()
    
    # Start the session with example story
    start_reading_session_sync(example_story.strip(), session_id="example-001", show_story=True)
