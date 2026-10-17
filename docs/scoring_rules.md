# Tactical Decision-Tree Scoring Framework

The ASTRA VEER scoring model is composed of three configurable pillars:

$$ \text{Total Score} = W_{\text{det}} \cdot S_{\text{det}} + W_{\text{cls}} \cdot S_{\text{cls}} + W_{\text{dec}} \cdot S_{\text{dec}} $$

Default weights:
- **Detection Latency ($W_{\text{det}}$)**: 30%
- **Classification Accuracy ($W_{\text{cls}}$)**: 30%
- **Decision Quality ($W_{\text{dec}}$)**: 40%

---

## 1. Detection Latency Curve
For each target, detection latency $\Delta t = t_{\text{detected}} - t_{\text{onset}}$ is scored along a linear decay window:

$$ S_{\text{det}}(\Delta t) = \begin{cases} 
100 & \text{if } \Delta t \le T_{\text{full}} \\
100 \cdot \left(1 - \frac{\Delta t - T_{\text{full}}}{T_{\text{max}} - T_{\text{full}}}\right) & \text{if } T_{\text{full}} < \Delta t < T_{\text{max}} \\
0 & \text{if } \Delta t \ge T_{\text{max}}
\end{cases} $$

### Difficulty Thresholds
| Difficulty Level | $T_{\text{full}}$ (Full Marks) | $T_{\text{max}}$ (Zero Mark Cutoff) |
|---|---|---|
| **Level 1 (Cadet)** | $\le 6.0\text{ s}$ | $20.0\text{ s}$ |
| **Level 2 (Tactical)** | $\le 4.5\text{ s}$ | $15.0\text{ s}$ |
| **Level 3 (Commander)** | $\le 3.0\text{ s}$ | $10.0\text{ s}$ |

Hostile drones that penetrate the defensive perimeter undetected trigger a severe penalty (-30 points).

---

## 2. Classification Accuracy
- **Hostile Drone**: High speed (>20 m/s), low RCS (-10 to -8 dBsm), RF telemetry 2.4/5.8 GHz.
- **Friendly Drone**: Verified military IFF transponder (1.4 GHz), stable patrol vector.
- **Commercial Drone**: Consumer ISM band, moderate speed, standard RCS.
- **Bird / False Alarm**: Biological radar cross-section (<-20 dBsm), no RF emissions, wing flapping flutter.

**Penalties**:
- Engaging a Friendly Drone with kinetic/jamming response is classified as **Friendly Fire** (-40 penalty).
- Kinetic response on False Alarms or Civilian Drones triggers Over-reaction penalties.

---

## 3. Decision Quality Tree
Evaluated per target based on `(True Class, Trainee Classification, Response, Proximity)`:
- **Optimal (100 pts)**: Immediate countermeasure on confirmed hostile close-in; IFF verification on friendlies; civil de-escalation.
- **Acceptable (80-85 pts)**: Alert raised; early tracking queue initialized.
- **Under-reaction (50 pts)**: Target near perimeter only queried for verification without alert.
- **Over-reaction (40-50 pts)**: Scrambling counter-measures on civil or benign tracks.
- **Dangerous Error (0-20 pts)**: Unmitigated perimeter breach by hostile, or engaging friendly blue-force aircraft.
