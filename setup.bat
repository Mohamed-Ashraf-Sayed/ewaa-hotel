@echo off
echo ============================================================
echo   Hotel CRM - First Time Setup
echo ============================================================
echo.

echo [1/5] Installing backend dependencies...
cd backend
call npm install
if errorlevel 1 ( echo ERROR: Backend install failed & pause & exit /b 1 )

echo [2/5] Generating Prisma client...
call npx prisma generate
if errorlevel 1 ( echo ERROR: Prisma generate failed & pause & exit /b 1 )

echo [3/5] Creating database...
call npx prisma db push
if errorlevel 1 ( echo ERROR: DB push failed & pause & exit /b 1 )

echo [4/5] Seeding with sample data...
call node src/seed.js
if errorlevel 1 ( echo ERROR: Seeding failed & pause & exit /b 1 )

cd ..

echo [5/5] Installing frontend dependencies...
cd frontend
call npm install
if errorlevel 1 ( echo ERROR: Frontend install failed & pause & exit /b 1 )
cd ..

echo.
echo ============================================================
echo   Setup Complete!
echo ============================================================
echo.
echo   Run start.bat to launch the application
echo.
echo   Login Credentials:
echo   - GM:               gm@hotelcrm.com / gm123
echo   - Vice GM:          vgm@hotelcrm.com / vgm123
echo   - Contract Officer: contracts@hotelcrm.com / contracts123
echo   - Sales Director:   dir1@hotelcrm.com / dir123
echo   - Sales Rep:        omar@hotelcrm.com / sales123
echo ============================================================
echo.
pause
