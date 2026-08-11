#!/bin/bash
# SLURM job to QLoRA fine-tune the coach model on a university HPC cluster (IITG PARAM etc.).
# It has REAL GPUs (A100/V100), so a 7B — even 13B — fine-tunes comfortably.
#
# Adapt the #SBATCH lines to YOUR cluster (`sinfo` for partitions, `module avail` for names,
# and your project/account code). Then:  sbatch ml/hpc_finetune.slurm
#
#SBATCH --job-name=vrittih-qlora
#SBATCH --partition=gpu               # <-- your GPU partition (sinfo)
#SBATCH --gres=gpu:1                  # 1 GPU is plenty for a 7B QLoRA
#SBATCH --cpus-per-task=8
#SBATCH --mem=64G
#SBATCH --time=06:00:00
#SBATCH --output=vrittih-qlora-%j.log
##SBATCH --account=YOUR_PROJECT       # <-- uncomment + set if your cluster requires it

set -euo pipefail
cd "$SLURM_SUBMIT_DIR"

# --- environment (module names vary per cluster: run `module avail`) ---
module load cuda 2>/dev/null || true
module load anaconda3 2>/dev/null || module load python 2>/dev/null || true

# one-time (run on the LOGIN node before first submit):
#   conda create -y -n vrittih python=3.11
#   conda activate vrittih
#   pip install torch transformers peft bitsandbytes datasets accelerate trl
source activate vrittih 2>/dev/null || conda activate vrittih 2>/dev/null || true

# IMPORTANT: HPC COMPUTE nodes usually have NO internet. Pre-download the base model on the
# LOGIN node first (it has internet), into a shared cache, then run offline here:
#   (login node)  export HF_HOME=$HOME/hf_cache
#                 python -c "from huggingface_hub import snapshot_download; snapshot_download('mistralai/Mistral-7B-Instruct-v0.3')"
export HF_HOME="${HF_HOME:-$HOME/hf_cache}"
export HF_HUB_DISABLE_XET=1
export HF_HUB_OFFLINE=1               # compute node is offline; use the pre-downloaded cache

# --- fine-tune (data comes from the committed ml/sft_seed.jsonl — no Node needed) ---
python ml/finetune_qlora.py --base mistralai/Mistral-7B-Instruct-v0.3 --epochs 3

echo "Done. LoRA adapter saved to ml/model/lora/  — copy it back with scp/rsync."
