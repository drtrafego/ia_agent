# WhatsApp Baileys - Deploy no Railway

## Por que não funciona no Vercel?
O Vercel é serverless - funções morrem após cada request. Baileys precisa de conexão WebSocket persistente 24/7.

## Arquitetura Recomendada

```
┌─────────────────┐         ┌─────────────────┐
│     Vercel      │         │    Railway      │
│  (Frontend +    │◄───────►│   (Baileys      │
│   API REST)     │   API   │   WhatsApp)     │
└─────────────────┘         └─────────────────┘
```

## Opções de Deploy

### Railway (Recomendado)
- Fácil deploy via Git
- $5/mês ou grátis com limites
- Zero manutenção

### Hostinger VPS
- Você já tem contratado
- Requer setup manual via SSH
- Controle total

## Próximos Passos (quando for implementar)
1. Criar micro-serviço separado para Baileys
2. Expor API REST para o Vercel consumir
3. Manter conexão WhatsApp persistente
