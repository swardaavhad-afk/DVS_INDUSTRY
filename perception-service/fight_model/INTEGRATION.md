# Integration with the existing FightDetector

Keep the current motion gate and pose feature extractor. Replace only the final heuristic scoring branch after a checkpoint has been trained.

```python
from fight_model.infer import FightSequenceClassifier, PairSequenceStore

classifier = FightSequenceClassifier("models/fight_lstm.pt")
sequences = PairSequenceStore(max_frames=classifier.max_frames)

# Inside FightDetector.evaluate(), after pair_feature_vector(...):
sequence = sequences.add(track_a, track_b, feature_vector)
if len(sequence) >= 16:
    fight_score = classifier.score(sequence)
    # Convert this into an EventCandidate. Do not create an incident here.
```

At the end of each cycle, evict pairs containing tracks that are no longer active:

```python
sequences.evict(active_track_ids)
```

Recommended confirmation policy to start tuning:

- candidate threshold: checkpoint threshold
- minimum sequence: 16 frames
- observations: at least 3 positive windows in the last 5
- persistence: at least 1.0 second
- cooldown after confirmed incident: 10 seconds
- low pose quality: suppress or downgrade

These are initial configuration values, not validated production thresholds.
