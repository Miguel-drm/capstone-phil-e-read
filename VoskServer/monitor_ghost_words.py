#!/usr/bin/env python3
"""
Real-Time Ghost Word Monitor
=============================

This script monitors the Vosk server logs in real-time and highlights
ghost words as they occur.

Usage:
    python monitor_ghost_words.py

Features:
- Real-time log monitoring
- Color-coded output (green=accepted, red=rejected)
- Statistics dashboard
- Ghost word alerts
"""

import sys
import time
import re
from collections import defaultdict
from datetime import datetime

# Color codes
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
CYAN = '\033[96m'
RESET = '\033[0m'
BOLD = '\033[1m'

class GhostWordMonitor:
    """Real-time monitor for ghost words."""
    
    def __init__(self):
        self.stats = {
            "accepted": 0,
            "rejected": 0,
            "total": 0,
            "ghost_words": [],
            "accepted_words": []
        }
        self.start_time = time.time()
    
    def process_log_line(self, line):
        """Process a log line and extract word information."""
        
        # Check for accepted words
        if "✅" in line and "in vocabulary" in line:
            match = re.search(r"'([^']+)'.*in vocabulary", line)
            if match:
                word = match.group(1)
                self.stats["accepted"] += 1
                self.stats["total"] += 1
                self.stats["accepted_words"].append(word)
                print(f"{GREEN}✅ ACCEPTED: '{word}'{RESET}")
                return
        
        # Check for phonetically matched words
        if "✅" in line and "phonetically matches" in line:
            match = re.search(r"'([^']+)'.*phonetically matches '([^']+)'", line)
            if match:
                word = match.group(1)
                matched = match.group(2)
                self.stats["accepted"] += 1
                self.stats["total"] += 1
                self.stats["accepted_words"].append(word)
                print(f"{GREEN}✅ ACCEPTED: '{word}' (matches '{matched}'){RESET}")
                return
        
        # Check for rejected words (ghost words)
        if "❌" in line and "NOT in story" in line:
            match = re.search(r"'([^']+)'.*NOT in story", line)
            if match:
                word = match.group(1)
                self.stats["rejected"] += 1
                self.stats["total"] += 1
                self.stats["ghost_words"].append(word)
                print(f"{RED}❌ GHOST WORD: '{word}'{RESET}")
                
                # Alert if too many ghost words
                if len(self.stats["ghost_words"]) > 5:
                    ghost_rate = self.stats["rejected"] / self.stats["total"]
                    if ghost_rate > 0.3:
                        print(f"{YELLOW}⚠️  WARNING: High ghost word rate ({ghost_rate*100:.1f}%){RESET}")
                return
        
        # Check for Vosk results
        if "🎤 Vosk" in line:
            print(f"{CYAN}{line.strip()}{RESET}")
            return
        
        # Check for vocabulary loading
        if "Story-aware recognition enabled" in line or "Story words:" in line or "Enhanced vocabulary:" in line:
            print(f"{BLUE}{line.strip()}{RESET}")
            return
    
    def print_dashboard(self):
        """Print statistics dashboard."""
        elapsed = time.time() - self.start_time
        
        print(f"\n{BOLD}{CYAN}{'='*70}{RESET}")
        print(f"{BOLD}{CYAN}GHOST WORD MONITOR - STATISTICS{RESET:^70}")
        print(f"{BOLD}{CYAN}{'='*70}{RESET}")
        
        print(f"\n{BOLD}Session Duration:{RESET} {elapsed:.1f}s")
        print(f"{BOLD}Total Words:{RESET} {self.stats['total']}")
        
        if self.stats['total'] > 0:
            accept_rate = self.stats['accepted'] / self.stats['total'] * 100
            reject_rate = self.stats['rejected'] / self.stats['total'] * 100
            
            print(f"{GREEN}{BOLD}Accepted:{RESET} {self.stats['accepted']} ({accept_rate:.1f}%)")
            print(f"{RED}{BOLD}Rejected (Ghosts):{RESET} {self.stats['rejected']} ({reject_rate:.1f}%)")
            
            # Alert if high ghost rate
            if reject_rate > 30:
                print(f"\n{YELLOW}{BOLD}⚠️  WARNING: High ghost word rate!{RESET}")
                print(f"{YELLOW}Consider:{RESET}")
                print(f"  - Reducing background noise")
                print(f"  - Adjusting microphone volume")
                print(f"  - Checking vocabulary is loaded")
        
        # Show recent ghost words
        if self.stats['ghost_words']:
            print(f"\n{BOLD}Recent Ghost Words:{RESET}")
            for word in self.stats['ghost_words'][-10:]:
                print(f"  {RED}❌{RESET} {word}")
        
        # Show recent accepted words
        if self.stats['accepted_words']:
            print(f"\n{BOLD}Recent Accepted Words:{RESET}")
            for word in self.stats['accepted_words'][-10:]:
                print(f"  {GREEN}✅{RESET} {word}")
        
        print(f"\n{BOLD}{CYAN}{'='*70}{RESET}\n")


def monitor_stdin():
    """Monitor stdin for log lines."""
    print(f"{BOLD}{CYAN}{'='*70}{RESET}")
    print(f"{BOLD}{CYAN}GHOST WORD MONITOR - REAL-TIME{RESET:^70}")
    print(f"{BOLD}{CYAN}{'='*70}{RESET}\n")
    
    print(f"{BLUE}Monitoring Vosk server logs...{RESET}")
    print(f"{BLUE}Pipe server output to this script:{RESET}")
    print(f"{CYAN}  python server.py | python monitor_ghost_words.py{RESET}\n")
    
    monitor = GhostWordMonitor()
    last_dashboard = time.time()
    
    try:
        for line in sys.stdin:
            monitor.process_log_line(line)
            
            # Print dashboard every 10 seconds
            if time.time() - last_dashboard > 10:
                monitor.print_dashboard()
                last_dashboard = time.time()
    
    except KeyboardInterrupt:
        print(f"\n{YELLOW}Monitoring stopped{RESET}")
    
    finally:
        monitor.print_dashboard()


def monitor_file(filename):
    """Monitor a log file for ghost words."""
    print(f"{BOLD}{CYAN}{'='*70}{RESET}")
    print(f"{BOLD}{CYAN}GHOST WORD MONITOR - FILE{RESET:^70}")
    print(f"{BOLD}{CYAN}{'='*70}{RESET}\n")
    
    print(f"{BLUE}Monitoring file: {filename}{RESET}\n")
    
    monitor = GhostWordMonitor()
    
    try:
        with open(filename, 'r') as f:
            # Read existing content
            for line in f:
                monitor.process_log_line(line)
            
            # Follow new content
            while True:
                line = f.readline()
                if line:
                    monitor.process_log_line(line)
                else:
                    time.sleep(0.1)
    
    except KeyboardInterrupt:
        print(f"\n{YELLOW}Monitoring stopped{RESET}")
    
    except FileNotFoundError:
        print(f"{RED}Error: File not found: {filename}{RESET}")
    
    finally:
        monitor.print_dashboard()


def main():
    """Main function."""
    if len(sys.argv) > 1:
        # Monitor file
        filename = sys.argv[1]
        monitor_file(filename)
    else:
        # Monitor stdin
        monitor_stdin()


if __name__ == "__main__":
    main()
