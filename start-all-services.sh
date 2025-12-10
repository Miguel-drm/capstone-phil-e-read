#!/bin/bash

echo "========================================"
echo "Starting All Services"
echo "========================================"
echo ""

# Start Frontend (Port 3000)
echo "[1/4] Starting Frontend..."
cd frontend && npm run dev &
FRONTEND_PID=$!
cd ..
sleep 2

# Start Backend Server (Port 5000)
echo "[2/4] Starting Backend Server..."
cd backend/server && npm run dev &
BACKEND_PID=$!
cd ../..
sleep 2

# Start Vosk Server (Port 2700)
echo "[3/4] Starting Vosk Server..."
cd VoskServer && python server.py &
VOSK_PID=$!
cd ..
sleep 2

# Start Optimistic Reading Server (Port 2701)
echo "[4/4] Starting Optimistic Reading Server..."
cd VoskServer && python start_optimistic_server.py &
OPTIMISTIC_PID=$!
cd ..
sleep 2

echo ""
echo "========================================"
echo "All Services Started!"
echo "========================================"
echo ""
echo "Services Running:"
echo "  Frontend:           http://localhost:3000 (PID: $FRONTEND_PID)"
echo "  Backend:            http://localhost:5000 (PID: $BACKEND_PID)"
echo "  Vosk Server:        ws://localhost:2700 (PID: $VOSK_PID)"
echo "  Optimistic Server:  ws://localhost:2701 (PID: $OPTIMISTIC_PID)"
echo ""
echo "To stop all services, press Ctrl+C"
echo ""

# Wait for all background processes
wait
