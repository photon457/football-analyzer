"""
Historical trend analysis and manager insight generator.
Calculates rolling averages, performance trajectory, and notable highlights across matches.
"""

from typing import List, Dict, Any
import statistics


def calculate_player_trends(matches_history: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes rolling metrics, consistency (standard deviation), and trend directions
    for a player across chronological match history.
    """
    if not matches_history:
        return {
            "total_matches": 0,
            "total_minutes": 0,
            "average_minutes": 0.0,
            "trajectory": "stable",
            "consistency_std": 0.0,
            "totals": {
                "goals": 0,
                "assists": 0,
                "shots": 0,
                "key_passes": 0,
                "tackles_won": 0,
                "interceptions": 0,
                "passes_completed": 0,
                "passes_attempted": 0,
                "pass_accuracy_pct": 0.0,
                "starts": 0,
                "sub_appearances": 0,
                "xg": 0.0,
            },
            "averages_per_90": {
                "goals_per_90": 0.0,
                "assists_per_90": 0.0,
                "shots_per_90": 0.0,
                "key_passes_per_90": 0.0,
                "passes_completed_per_90": 0.0,
                "tackles_per_90": 0.0,
                "interceptions_per_90": 0.0,
            },
            "radar_profile": {
                "Attacking": 50,
                "Passing": 50,
                "Defending": 50,
                "Duels": 50,
                "Workrate": 50,
            },
            "timeline": [],
            "insights": [],
        }

    timeline = []
    total_minutes = 0
    total_goals = 0
    total_assists = 0
    total_shots = 0
    total_key_passes = 0
    total_tackles = 0
    total_interceptions = 0
    total_passes_completed = 0
    total_passes_attempted = 0
    total_starts = 0
    total_subs = 0
    total_xg = 0.0

    minutes_list = []
    rating_approx = []

    for m in matches_history:
        metrics = m.get("metrics", {})
        mins = m.get("minutes_played", 0)
        total_minutes += mins
        minutes_list.append(mins)

        is_starter = bool(m.get("is_starter", True))
        if is_starter:
            total_starts += 1
        else:
            total_subs += 1

        g = int(metrics.get("goals", 0))
        a = int(metrics.get("assists", 0))
        s = int(metrics.get("shots_total", 0))
        kp = int(metrics.get("key_passes", 0))
        tw = int(metrics.get("tackles_won", 0))
        inter = int(metrics.get("interceptions", 0))
        pc = int(metrics.get("passes_completed", 0))
        pa = int(metrics.get("passes_attempted", 0))
        xg_val = float(metrics.get("xg", round(g * 0.45 + s * 0.08, 2)))

        total_goals += g
        total_assists += a
        total_shots += s
        total_key_passes += kp
        total_tackles += tw
        total_interceptions += inter
        total_passes_completed += pc
        total_passes_attempted += pa
        total_xg += xg_val

        pass_acc = round((pc / pa * 100), 1) if pa > 0 else 0.0

        # Match contribution score
        score = (g * 3.0) + (a * 2.0) + (kp * 1.0) + (tw * 1.0) + (inter * 1.0) + (pc * 0.05)
        rating_approx.append(round(score, 1))

        timeline.append({
            "match_id": m.get("match_id"),
            "date": m.get("date"),
            "opponent": m.get("opponent"),
            "home_away": m.get("home_away", "home"),
            "result": m.get("result", "W"),
            "score_team": m.get("score_team", 0),
            "score_opponent": m.get("score_opponent", 0),
            "position": m.get("position", "MF"),
            "is_starter": is_starter,
            "minutes_played": mins,
            "goals": g,
            "assists": a,
            "shots": s,
            "key_passes": kp,
            "tackles_won": tw,
            "interceptions": inter,
            "passes_completed": pc,
            "passes_attempted": pa,
            "pass_accuracy_pct": pass_acc,
            "xg": round(xg_val, 2),
            "contribution_score": round(score, 1),
        })

    num_matches = len(matches_history)
    avg_mins = round(total_minutes / num_matches, 1)

    # Consistency measurement (lower std dev = more consistent)
    consistency_std = round(statistics.stdev(rating_approx), 2) if len(rating_approx) > 1 else 0.0

    # Trend detection (comparing recent vs earlier matches)
    recent_split = max(1, num_matches // 2)
    earlier_scores = rating_approx[:recent_split]
    recent_scores = rating_approx[recent_split:]

    earlier_avg = sum(earlier_scores) / len(earlier_scores) if earlier_scores else 0.0
    recent_avg = sum(recent_scores) / len(recent_scores) if recent_scores else 0.0

    if recent_avg > earlier_avg * 1.15:
        trajectory = "improving"
    elif recent_avg < earlier_avg * 0.85:
        trajectory = "declining"
    else:
        trajectory = "stable"

    # Per-90 averages
    denom_90 = total_minutes / 90.0 if total_minutes > 0 else 1.0
    g_p90 = round(total_goals / denom_90, 2)
    a_p90 = round(total_assists / denom_90, 2)
    s_p90 = round(total_shots / denom_90, 2)
    kp_p90 = round(total_key_passes / denom_90, 2)
    pc_p90 = round(total_passes_completed / denom_90, 1)
    tw_p90 = round(total_tackles / denom_90, 2)
    int_p90 = round(total_interceptions / denom_90, 2)

    overall_pass_acc = round((total_passes_completed / total_passes_attempted * 100), 1) if total_passes_attempted > 0 else 80.0

    # 5-Axis Tactical Radar Profile (0-100)
    radar_profile = {
        "Attacking": min(98, max(20, int(35 + (g_p90 * 35) + (s_p90 * 12)))),
        "Passing": min(98, max(20, int((overall_pass_acc * 0.6) + (kp_p90 * 12)))),
        "Defending": min(98, max(20, int(30 + (tw_p90 * 16) + (int_p90 * 14)))),
        "Duels": min(98, max(20, int(40 + (tw_p90 * 14)))),
        "Workrate": min(98, max(20, int(30 + (avg_mins / 90 * 45) + ((tw_p90 + kp_p90) * 8)))),
    }

    # Manager-oriented insights
    insights = []
    if total_goals >= 2:
        insights.append(f"High goal threat: {total_goals} goals in {num_matches} matches ({g_p90} per 90)")
    if a_p90 >= 0.3 or total_key_passes >= num_matches * 2:
        insights.append("Creative playmaker generating consistent goal-scoring opportunities")
    if total_tackles + total_interceptions >= num_matches * 3:
        insights.append("Strong defensive workrate with high ball recovery count")
    if consistency_std < 1.5 and num_matches >= 3:
        insights.append("Highly consistent performer across all match fixtures")
    if overall_pass_acc >= 85.0 and total_passes_completed >= 40:
        insights.append(f"Elite ball retention: {overall_pass_acc}% overall passing accuracy")

    return {
        "total_matches": num_matches,
        "total_minutes": total_minutes,
        "average_minutes": avg_mins,
        "trajectory": trajectory,
        "consistency_std": consistency_std,
        "totals": {
            "goals": total_goals,
            "assists": total_assists,
            "shots": total_shots,
            "key_passes": total_key_passes,
            "tackles_won": total_tackles,
            "interceptions": total_interceptions,
            "passes_completed": total_passes_completed,
            "passes_attempted": total_passes_attempted,
            "pass_accuracy_pct": overall_pass_acc,
            "starts": total_starts,
            "sub_appearances": total_subs,
            "xg": round(total_xg, 2),
        },
        "averages_per_90": {
            "goals_per_90": g_p90,
            "assists_per_90": a_p90,
            "shots_per_90": s_p90,
            "key_passes_per_90": kp_p90,
            "passes_completed_per_90": pc_p90,
            "tackles_per_90": tw_p90,
            "interceptions_per_90": int_p90,
        },
        "radar_profile": radar_profile,
        "timeline": timeline,
        "insights": insights,
    }
