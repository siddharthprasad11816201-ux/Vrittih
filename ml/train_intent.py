#!/usr/bin/env python3
"""ICIRE — train a SMALL intent classifier FROM SCRATCH on the in-house intent data.

No pretrained weights, no external model, no external dataset — just PyTorch (a library)
over ml/data/intents.json, trained entirely on THIS machine. This is the "train your own
model" path for the coach's `transformer` brain. Outputs ml/model/model.pt.

    npm run ml:export          # regenerate ml/data/intents.json from lib/career/intentData.ts
    pip install torch
    python ml/train_intent.py  # uses CUDA if available, else CPU (tiny model, seconds)
"""
import json, os, re, random
import torch
import torch.nn as nn

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "intents.json")
MODELDIR = os.path.join(HERE, "model")
os.makedirs(MODELDIR, exist_ok=True)

random.seed(1234)
torch.manual_seed(1234)


def tokenize(s):
    return [t for t in re.split(r"[^a-z0-9+#]+", s.lower()) if t]


class IntentClassifier(nn.Module):
    """Embedding + a small from-scratch Transformer encoder + masked mean-pool + head."""

    def __init__(self, vocab_size, dim, num_classes, maxlen):
        super().__init__()
        self.emb = nn.Embedding(vocab_size, dim, padding_idx=0)
        self.pos = nn.Parameter(torch.zeros(1, maxlen, dim))
        layer = nn.TransformerEncoderLayer(d_model=dim, nhead=4, dim_feedforward=128,
                                           dropout=0.1, batch_first=True)
        self.encoder = nn.TransformerEncoder(layer, num_layers=2)
        self.head = nn.Linear(dim, num_classes)

    def forward(self, x):
        mask = x == 0  # pad mask
        h = self.emb(x) + self.pos[:, : x.size(1), :]
        h = self.encoder(h, src_key_padding_mask=mask)
        keep = (~mask).unsqueeze(-1).float()
        h = (h * keep).sum(1) / keep.sum(1).clamp(min=1)  # masked mean-pool
        return self.head(h)


def main():
    data = json.load(open(DATA, encoding="utf-8"))
    texts = [d["text"] for d in data]
    labels_raw = [d["intent"] for d in data]
    labels = sorted(set(labels_raw))
    lab2i = {l: i for i, l in enumerate(labels)}

    vocab = {"<pad>": 0, "<unk>": 1}
    for t in texts:
        for tok in tokenize(t):
            vocab.setdefault(tok, len(vocab))
    maxlen = max(len(tokenize(t)) for t in texts)

    def encode(s):
        ids = [vocab.get(tok, 1) for tok in tokenize(s)][:maxlen]
        return ids + [0] * (maxlen - len(ids))

    X = torch.tensor([encode(t) for t in texts], dtype=torch.long)
    Y = torch.tensor([lab2i[l] for l in labels_raw], dtype=torch.long)

    dim = 64
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = IntentClassifier(len(vocab), dim, len(labels), maxlen).to(dev)
    X, Y = X.to(dev), Y.to(dev)
    opt = torch.optim.Adam(model.parameters(), lr=2e-3, weight_decay=1e-4)
    loss_fn = nn.CrossEntropyLoss()

    model.train()
    epochs = 400
    for ep in range(epochs):
        opt.zero_grad()
        out = model(X)
        loss = loss_fn(out, Y)
        loss.backward()
        opt.step()
        if (ep + 1) % 50 == 0:
            acc = (out.argmax(1) == Y).float().mean().item()
            print(f"epoch {ep + 1}/{epochs}  loss {loss.item():.4f}  train-acc {acc:.3f}")

    torch.save(
        {"state_dict": model.state_dict(), "dim": dim, "maxlen": maxlen, "vocab": vocab, "labels": labels},
        os.path.join(MODELDIR, "model.pt"),
    )
    print(f"Saved -> {os.path.join(MODELDIR, 'model.pt')}  ({len(vocab)} vocab, {len(labels)} intents, maxlen {maxlen})")


if __name__ == "__main__":
    main()
