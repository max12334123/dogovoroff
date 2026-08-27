# Read-only Supabase RLS smoke test

`npm run supabase:smoke` проверяет изоляцию кабинета в подключённом проекте Supabase.
Скрипт использует только publishable key и временные access token тестовых аккаунтов.
Он не создаёт, не изменяет и не удаляет строки или объекты Storage.

## Что проверяется

- клиент A видит только дело A;
- клиент B видит только дело B;
- юрист видит только дела из своего тестового scope;
- администратор видит дела из своего тестового scope и имеет роль `admin`;
- клиентские аккаунты не читают `organization_members`;
- метаданные этапов, событий, документов и сообщений повторяют границы дел;
- клиент A не получает список объектов Storage из папки дела B;
- анонимный клиент не читает дела.

## Подготовка тестовых данных

В Supabase Dashboard создайте четыре отдельные тестовые учётные записи и два
обезличенных дела A/B. Назначьте клиенту A только дело A, клиенту B только дело B,
юристу — согласованный набор дел, администратору — все дела тестовой организации.
Не используйте реальные клиентские документы и сообщения.

Получите access token каждой тестовой сессии обычным способом входа. Токены являются
секретами: не добавляйте их в `.env.example`, Git, issue или сообщения.

## Запуск в PowerShell

```powershell
$env:SUPABASE_E2E_ENABLED = "true"
$env:SUPABASE_E2E_CLIENT_A_TOKEN = "<temporary-client-a-access-token>"
$env:SUPABASE_E2E_CLIENT_B_TOKEN = "<temporary-client-b-access-token>"
$env:SUPABASE_E2E_LAWYER_TOKEN = "<temporary-lawyer-access-token>"
$env:SUPABASE_E2E_ADMIN_TOKEN = "<temporary-admin-access-token>"
$env:SUPABASE_E2E_MATTER_A_ID = "<matter-a-uuid>"
$env:SUPABASE_E2E_MATTER_B_ID = "<matter-b-uuid>"
$env:SUPABASE_E2E_LAWYER_MATTER_IDS = "<matter-a-uuid>"
$env:SUPABASE_E2E_ADMIN_MATTER_IDS = "<matter-a-uuid>,<matter-b-uuid>"

npm run supabase:smoke
```

Без `SUPABASE_E2E_ENABLED=true` команда завершается безопасным `skipped` и не делает
сетевых запросов. При включённом режиме неполная конфигурация завершается ошибкой до
создания Supabase-клиента. В вывод попадают только названия проверок и коды ошибок,
не токены, тексты сообщений или содержимое документов.

После проверки удалите переменные из текущего процесса:

```powershell
Get-ChildItem Env:SUPABASE_E2E_* | Remove-Item
```
