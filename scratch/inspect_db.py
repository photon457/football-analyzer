import sqlite3
import json

conn = sqlite3.connect("data/football_analyzer.db")
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [r[0] for r in cursor.fetchall() if not r[0].startswith("sqlite_")]
print("TABLES:", tables)

for t in tables:
    cursor.execute(f"SELECT COUNT(*) FROM {t}")
    count = cursor.fetchone()[0]
    cursor.execute(f"PRAGMA table_info({t});")
    cols = cursor.fetchall()
    print(f"\n================ TABLE: {t} ({count} rows) ================")
    for c in cols:
        cid, name, col_type, notnull, dflt, pk = c
        print(f"  - {name} ({col_type}){' NOT NULL' if notnull else ''}{' PK' if pk else ''}")

# Let's inspect all matches
cursor.execute("SELECT id, date, competition, team, opponent, home_away, result, score_team, score_opponent FROM matches ORDER BY date")
matches = cursor.fetchall()
print("\n================ MATCHES IN DATABASE ================")
for m in matches:
    print(m)

# Let's inspect players count and distinct teams
cursor.execute("SELECT primary_position, COUNT(*) FROM players GROUP BY primary_position")
print("\n================ PLAYERS BY POSITION ================")
for p in cursor.fetchall():
    print(p)

# Sample 5 players
cursor.execute("SELECT id, name, primary_position, squad_number FROM players LIMIT 10")
print("\n================ SAMPLE PLAYERS ================")
for p in cursor.fetchall():
    print(p)

# Fixtures count by phase and status
cursor.execute("SELECT phase, COUNT(*), SUM(CASE WHEN match_id IS NOT NULL THEN 1 ELSE 0 END) FROM fixtures GROUP BY phase")
print("\n================ FIXTURES BY PHASE ================")
for f in cursor.fetchall():
    print("Phase:", f[0], "Total:", f[1], "Played/Linked:", f[2])
