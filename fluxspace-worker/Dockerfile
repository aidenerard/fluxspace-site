FROM python:3.11-slim

WORKDIR /app

# System libraries required by Open3D and OpenCV headless
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libgomp1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY reconstruct.py .
COPY assets ./assets

ENV PORT=8080
EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
