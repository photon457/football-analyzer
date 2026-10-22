import sqlite3

conn = sqlite3.connect("data/football_analyzer.db")
cursor = conn.cursor()

cursor.execute("""
SELECT p.id, p.name, p.squad_number, p.primary_position,
       SUM(CASE WHEN pmm.metric_name = 'goals' THEN pmm.raw_value ELSE 0 END) as goals,
       SUM(CASE WHEN pmm.metric_name = 'assists' THEN pmm.raw_value ELSE 0 END) as assists,
       SUM(CASE WHEN pmm.metric_name = 'shots' THEN pmm.raw_value ELSE 0 END) as shots,
       ROUND(SUM(CASE WHEN pmm.metric_name = 'xg' THEN pmm.raw_value ELSE 0 END), 2) as xg,
       SUM(CASE WHEN pmm.metric_name = 'passes_completed' THEN pmm.raw_value ELSE 0 END) as passes,
       SUM(CASE WHEN pmm.metric_name = 'tackles' THEN pmm.raw_value ELSE 0 END) as tackles,
       SUM(CASE WHEN pmm.metric_name = 'interceptions' THEN pmm.raw_value ELSE 0 END) as interceptions,
       SUM(CASE WHEN pmm.metric_name = 'yellow_cards' THEN pmm.raw_value ELSE 0 END) as yc,
       SUM(CASE WHEN pmm.metric_name = 'red_cards' THEN pmm.raw_value ELSE 0 END) as rc
FROM players p
JOIN player_match_metrics pmm ON p.id = pmm.player_id
JOIN matches m ON pmm.match_id = m.id
WHERE m.team = 'Chelsea' AND p.id LIKE 'p_%'
GROUP BY p.id
ORDER BY goals DESC, assists DESC, shots DESC
""")

print("CHELSEA SQUAD EXACT TOTALS:")
for r in cursor.fetchall():
    print(r)
