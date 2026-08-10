#!/usr/bin/env python3
"""ICIRE — serve the from-scratch intent classifier locally for the coach's `transformer`
brain. Runs on YOUR machine; nothing leaves it, no SaaS.

    POST /classify  {"text": "..."}  ->  {"intent": "matches", "confidence": 0.97}

Set in the app env:  COACH_BRAIN=transformer  and  TRANSFORMER_URL=http://localhost:8077/classify

    pip install torch
    python ml/train_intent.py
    python ml/serve_intent.py         # listens on 127.0.0.1:8077 (PORT to override)

The model classifies intent ONLY — the coach still extracts slots + composes every answer
in-house, so this can never fabricate advice.
"""
import json, os, re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import torch
import torch.nn as nn

HERE = os.path.dirname(os.path.abspath(__file__))
CKPT = torch.load(os.path.join(HERE, "model", "model.pt"), map_location="cpu")
VOCAB, LABELS, DIM, MAXLEN = CKPT["vocab"], CKPT["labels"], CKPT["dim"], CKPT["maxlen"]


class IntentClassifier(nn.Module):  # architecture must match train_intent.py
    def __init__(self, vocab_size, dim, num_classes, maxlen):
        super().__init__()
        self.emb = nn.Embedding(vocab_size, dim, padding_idx=0)
        self.pos = nn.Parameter(torch.zeros(1, maxlen, dim))
        layer = nn.TransformerEncoderLayer(d_model=dim, nhead=4, dim_feedforward=128,
                                           dropout=0.1, batch_first=True)
        self.encoder = nn.TransformerEncoder(layer, num_layers=2)
        self.head = nn.Linear(dim, num_classes)

    def forward(self, x):
        mask = x == 0
        h = self.emb(x) + self.pos[:, : x.size(1), :]
        h = self.encoder(h, src_key_padding_mask=mask)
        keep = (~mask).unsqueeze(-1).float()
        h = (h * keep).sum(1) / keep.sum(1).clamp(min=1)
        return self.head(h)


model = IntentClassifier(len(VOCAB), DIM, len(LABELS), MAXLEN)
model.load_state_dict(CKPT["state_dict"])
model.eval()


def tokenize(s):
    return [t for t in re.split(r"[^a-z0-9+#]+", s.lower()) if t]


def encode(s):
    ids = [VOCAB.get(t, 1) for t in tokenize(s)][:MAXLEN]
    return ids + [0] * (MAXLEN - len(ids))


def classify(text):
    x = torch.tensor([encode(text)], dtype=torch.long)
    with torch.no_grad():
        probs = torch.softmax(model(x), dim=1)[0]
    i = int(probs.argmax())
    return LABELS[i], float(probs[i])


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_POST(self):
        if self.path != "/classify":
            return self._send(404, {"error": "not found"})
        try:
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n) or b"{}")
            text = str(body.get("text", ""))[:500]
            if not text.strip():
                return self._send(400, {"error": "empty"})
            intent, conf = classify(text)
            self._send(200, {"intent": intent, "confidence": round(conf, 4)})
        except Exception as e:  # noqa: BLE001
            self._send(500, {"error": str(e)})

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8077"))
    print(f"intent classifier on http://127.0.0.1:{port}/classify  ({len(LABELS)} intents)")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
