КАК ПОЛУЧИТЬ ПРИЛОЖЕНИЯ (ничего устанавливать не нужно)

1. Зайдите на github.com -> справа сверху «+» -> New repository. Назовите, например, casper-vpn, нажмите Create repository.
2. На странице репозитория нажмите «uploading an existing file» и перетащите ВСЁ содержимое этой папки (www, electron, .github, package.json, capacitor.config.json). Нажмите Commit changes.
   Если папка .github не загрузилась: Add file -> Create new file, в имени файла впишите .github/workflows/build.yml и вставьте туда текст из одноимённого файла.
3. Вкладка Actions -> слева «build» -> справа «Run workflow» -> зелёная кнопка Run workflow.
4. Через 5-10 минут откройте завершённый запуск. Внизу страницы, в блоке Artifacts:
   casper-vpn-android -> внутри app-debug.apk (на телефон)
   casper-vpn-windows -> внутри Casper VPN ... .exe (на компьютер)

ИЗМЕНИТЬ ИНТЕРФЕЙС: правьте файл www/index.html и снова запустите шаг 3.
