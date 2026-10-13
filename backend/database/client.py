"""
Database client management for Supabase and local relational fallback.
Follows Core-4 Rule 13: Never expose service-role key to renderer.
"""

import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")


def is_supabase_configured() -> bool:
    """Returns True if valid remote Supabase credentials are provided."""
    return bool(
        SUPABASE_URL
        and SUPABASE_KEY
        and not SUPABASE_URL.startswith("https://your-project")
        and not SUPABASE_KEY.startswith("your-anon")
    )


def get_supabase_client():
    """Returns an authenticated Supabase client if configured, else None."""
    if not is_supabase_configured():
        return None
    try:
        from supabase import create_client, Client
        client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        return client
    except Exception as e:
        print(f"Warning: Failed to initialize Supabase client: {e}")
        return None
