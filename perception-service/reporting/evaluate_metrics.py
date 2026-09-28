tp = 18
fp = 3
fn = 2
tn = 17

total = tp + fp + fn + tn

accuracy = (tp + tn) / total if total else 0
precision = tp / (tp + fp) if tp + fp else 0
recall = tp / (tp + fn) if tp + fn else 0
f1 = (
    2 * precision * recall / (precision + recall)
    if precision + recall
    else 0
)

print(f"Accuracy:  {accuracy:.2%}")
print(f"Precision: {precision:.2%}")
print(f"Recall:    {recall:.2%}")
print(f"F1 score:  {f1:.2%}")