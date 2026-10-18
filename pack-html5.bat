@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

rem Упаковка загрузочного экрана Moony Dreams в HTML5 (index.html + zip) в build\html5\
rem   Двойной клик            - чистый HTML5-шаблон с лоадером
rem   Перетащить .html на bat - лоадер встраивается в эту игру
rem   pack-html5.bat game.html --name my_playable

where python >nul 2>nul
if errorlevel 1 (
  echo [ОШИБКА] Python не найден. Установите Python 3 и добавьте его в PATH.
  goto :fail
)

python -c "import PIL" >nul 2>nul
if errorlevel 1 (
  echo Устанавливаю Pillow...
  python -m pip install --quiet Pillow
  if errorlevel 1 goto :fail
)

python loader\pack.py %*
if errorlevel 1 goto :fail

echo.
echo Готово. Сборка лежит в build\html5\
if "%~1"=="" explorer "build\html5"
pause
exit /b 0

:fail
echo.
echo Сборка не удалась.
pause
exit /b 1
