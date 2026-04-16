@echo off
echo ============================================================
echo   Hotel CRM - Sales ^& Contract Management System
echo ============================================================
echo.

REM Check if node_modules exist for backend
if not exist "backend\node_modules" (
    echo [1/4] Installing backend dependencies...
    cd backend
    call npm install
    cd ..
) else (
    echo [1/4] Backend dependencies OK
)

REM Check if node_modules exist for frontend
if not exist "frontend\node_modules" (
    echo [2/4] Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
) else (
    echo [2/4] Frontend dependencies OK
)

REM Setup database
echo [3/4] Setting up database...
cd backend
call npx prisma db push
echo [4/4] Seeding database with sample data...
call node src/seed.js
cd ..

echo.
echo ============================================================
echo   Starting servers...
echo ============================================================
echo.
echo   Backend API:  http://localhost:3001
echo   Frontend:     http://localhost:5173
echo.
echo   Press Ctrl+C to stop
echo ============================================================
echo.

REM Start both servers
start "Hotel CRM Backend" cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak >nul
start "Hotel CRM Frontend" cmd /k "cd frontend && npm run dev"

echo Both servers are starting...
echo Open http://localhost:5173 in your browser
echo.
pause
