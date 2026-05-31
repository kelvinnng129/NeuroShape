FROM python:3.10-slim

# Create a secure non-root user required by Hugging Face

RUN useradd -m -u 1000 user

ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    XDG_CACHE_HOME=/tmp/.cache \
    TORCH_HOME=/tmp/.cache/torch \
    HF_HOME=/tmp/.cache/huggingface

WORKDIR $HOME/app
COPY --chown=user server/requirements.txt $HOME/app/
RUN pip install --no-cache-dir --upgrade -r requirements.txt

COPY --chown=user server/ $HOME/app/

USER user

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]