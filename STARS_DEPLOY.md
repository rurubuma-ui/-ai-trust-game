# Деплой Stars и донатов

## Что добавлено

1. **Stars-оплата в игре:** Профиль → Разработчики и правила → «⭐ Поддержать Stars»
2. **Команда /donate в боте:** Отправляет счёт на 10 Stars
3. **TON-адрес** в модалке и в футере игры
4. **API** `POST /api/invoice/create` — создаёт ссылку на оплату

## Деплой

```powershell
cd c:\Users\maxdz\Desktop\opensakrat\yandex2
.\deploy-upload.ps1
```

Затем на сервере:

```bash
ssh root@213.108.4.68
cd /opt/realorai
pm2 restart realorai
cd tg && pm2 restart realorai-bot
```

## Stars в BotFather

Stars для цифровых товаров **не требуют** настройки в BotFather. Достаточно использовать `currency: 'XTR'` и пустой `provider_token`.

## Вывод Stars в TON

Владелец бота получает Stars на счёт Fragment. Вывод в TON: Fragment → Withdraw → TON-адрес `UQCKLUHkp30qHPtId3q0E80cS4vhTWknJB4ue2nsAolW78sf`.
