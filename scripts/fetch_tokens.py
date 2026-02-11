#!/usr/bin/env python3
"""
Alice Blue Token Fetcher
Fetches user tokens from Alice Blue using the Python SDK
"""

import json
import sys
from pathlib import Path

try:
    from alice_blue import Aliceblue
except ImportError:
    print("Error: alice_blue SDK not installed")
    print("Install it with: pip install alice-blue")
    sys.exit(1)


def fetch_tokens_from_alice(
    username: str,
    password: str,
    api_key: str,
    api_secret: str,
    output_file: str = ".alice.tokens.json"
) -> bool:
    """
    Fetch authentication tokens from Alice Blue for a user
    
    Args:
        username: Alice Blue username/client ID
        password: Alice Blue password
        api_key: Alice Blue API key
        api_secret: Alice Blue API secret
        output_file: Path to save tokens JSON
    
    Returns:
        True if successful, False otherwise
    """
    try:
        print(f"🔐 Connecting to Alice Blue for user: {username}")
        
        # Initialize Alice Blue connection
        alice = Aliceblue(
            username=username,
            password=password,
            api_key=api_key,
            api_secret=api_secret
        )
        
        print("✅ Connected successfully!")
        
        # Get user session token
        if hasattr(alice, 'session_token'):
            token = alice.session_token
        elif hasattr(alice, 'auth_token'):
            token = alice.auth_token
        else:
            print("⚠️  Could not extract token from session")
            return False
        
        # Load existing tokens
        tokens = {}
        if Path(output_file).exists():
            try:
                with open(output_file, 'r') as f:
                    tokens = json.load(f)
            except json.JSONDecodeError:
                tokens = {}
        
        # Add/update token for this user
        tokens[username] = token
        
        # Save tokens
        with open(output_file, 'w') as f:
            json.dump(tokens, f, indent=2)
        
        print(f"✅ Token saved to {output_file}")
        print(f"   User: {username}")
        print(f"   Token: {token[:10]}...{token[-4:]}")
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False


def list_tokens(tokens_file: str = ".alice.tokens.json"):
    """List all stored tokens"""
    try:
        if Path(tokens_file).exists():
            with open(tokens_file, 'r') as f:
                tokens = json.load(f)
            
            print(f"\n📋 Stored tokens in {tokens_file}:")
            for user, token in tokens.items():
                masked = f"{token[:10]}...{token[-4:]}"
                print(f"  • {user}: {masked}")
        else:
            print(f"No tokens file found at {tokens_file}")
    except Exception as e:
        print(f"Error reading tokens: {str(e)}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python fetch_tokens.py list                              # List all tokens")
        print("  python fetch_tokens.py add <username> <password> <api_key> <api_secret>")
        print("\nExample:")
        print("  python fetch_tokens.py add trader123 pass123 key123 secret123")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "list":
        list_tokens()
    elif command == "add":
        if len(sys.argv) < 6:
            print("❌ Missing arguments for 'add' command")
            print("Usage: python fetch_tokens.py add <username> <password> <api_key> <api_secret>")
            sys.exit(1)
        
        username = sys.argv[2]
        password = sys.argv[3]
        api_key = sys.argv[4]
        api_secret = sys.argv[5]
        
        success = fetch_tokens_from_alice(username, password, api_key, api_secret)
        sys.exit(0 if success else 1)
    else:
        print(f"❌ Unknown command: {command}")
        sys.exit(1)
