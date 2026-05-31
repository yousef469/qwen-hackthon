FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY frontend frontend/
RUN cd frontend && npm install && npm run build

COPY . .
RUN rm -rf frontend/src frontend/node_modules frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/vite.config.ts frontend/tsconfig.app.json frontend/tsconfig.node.json frontend/index.html

EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
