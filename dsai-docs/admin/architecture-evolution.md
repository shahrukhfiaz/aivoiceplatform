---
title: Architectural Evolution of Digital Storming AI (DSAI)
description: 
published: false
date: 2025-10-13T12:40:07.802Z
tags: admin, architec
editor: markdown
dateCreated: 2025-10-13T12:17:13.684Z
---

# Architectural Evolution of Digital Storming AI (DSAI)

## Introduction

The **Digital Storming AI (DSAI)** project is evolving toward a new architecture focused on scalability, tenant autonomy, and centralized license management.  
This vision is structured into **three main macro-architectures**, each with a specific role in the ecosystem:

1. **DSAI Application (per-tenant)** – Dedicated environment for deploying the voice agent core components.  
2. **DSAI Multi-Tenant Platform** – User management, provisioning, and tenant orchestration layer.  
3. **DSAI License Service** – Centralized system for managing credits and licenses.

The goal is to ensure **deployment flexibility**, **environment isolation**, and **centralized governance** across all tenants.

---

## 1. DSAI Application (Per-Tenant Environment)

### Description

Each **tenant** has its own **isolated instance** of DSAI Application.  
This instance includes all key services required for intelligent voice agent execution:

- **DSAI Core** – Handles audio, orchestrates between services, and interfaces with Asterisk PBX.  
- **ASR (Automatic Speech Recognition)** – Transcribes audio using cloud or local providers.  
- **LLM (Language Model)** – Performs semantic reasoning and response generation.  
- **TTS (Text-to-Speech)** – Converts responses back into speech or directly produces a voice response.  
- **STS (Speech-to-Speech)**
- **Dedicated Database** – Stores configurations, logs, and metrics specific to the tenant.  

Each tenant also has a **dedicated private network**, ensuring isolation and secure communication.

### Shared Asterisk

In this **initial implementation phase**, the infrastructure uses a **single shared Asterisk instance** for all tenants.  
Operationally:

- Each tenant has its own configuration files (`extensions.conf`, `pjsip.conf`, etc.).  
- The Multi-Tenant Platform manages writing these configurations for each tenant within the shared Asterisk context.  
- The architecture is designed to evolve toward a **multi-instance Asterisk** setup for full isolation in later phases.

This approach simplifies initial deployment, reduces operational overhead, and accelerates rollout, while maintaining logical separation between tenants.

### Deployment

Deployment methods are **flexible and up to the technical team**, supporting:  
- Docker Compose  
- Kubernetes  
- Custom orchestrators (e.g., VAPI or internal automation tools)

This flexibility allows adaptation to different environments (public cloud, data center, or on-premise).

### Objective

Provide a fully independent environment per tenant, scalable and customizable for multiple agents—each with its own configuration or API key.

---

## 2. DSAI Multi-Tenant Platform

### Role and Functions

The **Multi-Tenant Platform** serves as the top-level management and orchestration layer.  
It is responsible for centralized tenant administration and provisioning.

Key functions include:

- **User Registration (Sign-up)**  
  Create user accounts through a web interface (email/password or SSO).

- **Tenant Management**  
  - Create a new tenant with automated provisioning of its dedicated DSAI Application.  
  - Suspend or reactivate tenants.  
  - Delete tenants and perform environment cleanup.

- **Automated Provisioning**
  After registration, a **provisioning workflow** triggers automatically to:
  1. Generate a new namespace or isolated network.  
  2. Deploy DSAI Core, ASR, LLM, TTS, STS, and database containers.  
  3. Register connection details.  
  4. Associate the tenant with a license via the License Service.

- **License Management**
  Each tenant must have an active **license**.  
  The platform communicates with the **License Service** to:  
  - Retrieve available credits.  
  - Update used minutes after each call.  
  It’s under consideration whether this integration will occur directly at the Multi-Tenant Platform level or through the DSAI Application.

### Load Balancer and Multi-Domain Routing

For HTTP/HTTPS traffic management, a **load balancer** handles routing based on subdomains.

- Example subdomains:  
  - `tenant1.agentvoiceresponse.com`  
  - `tenant2.agentvoiceresponse.com`  

The load balancer forwards requests to the secure environment of the correct tenant based on the subdomain.  
While the technical implementation is left open, **Traefik** is recommended for its native container integration and automatic TLS certificate management.

Routing schema:

```
Internet
   ↓
[Traefik Load Balancer]
   ↓ (routes by subdomain)
[DSAI Tenant 1] ← tenant1.agentvoiceresponse.com
[DSAI Tenant 2] ← tenant2.agentvoiceresponse.com
[DSAI Tenant N] ← tenantN.agentvoiceresponse.com
```

This design ensures secure isolation and scalability, while simplifying SSL management and reverse proxy configuration per tenant.

### Local Deployment

The entire platform **can also be deployed locally**, including:
- Multi-Tenant Platform  
- DSAI Application (one or more local tenants)  
- Asterisk PBX (optional)
- Database  

In this setup, the **License Service always remains cloud-hosted**, managed by the Agent Voice Response team.

### Communication Architecture

```
[Web User]
   ↓
[DSAI Multi-Tenant Platform]
   ├──> [Provisioning Engine] → creates tenant containers, DB, network
   ├──> [Traefik Load Balancer] → routes traffic to tenant environments
   ├──> [Shared Asterisk] → handles multi-tenant voice sessions
   ├──> [DSAI License Service] → get/update credits
   └──> [DSAI Application Tenant #N] → deploy and manage voice agents
```

---

## 3. DSAI License Service

### Purpose

The **License Service** manages licenses and usage for all tenants.  
It is a **centralized, cloud-only service**, not replicated locally.

### Main Endpoints

- **GET /license/{id}/credits** – Returns remaining credits (minutes or units).  
- **POST /license/{id}/update** – Receives conversation minutes and updates license usage.

### Authentication

Services authenticate via **API Key**.  
A single license may include multiple API Keys, for example:
- One shared key for all tenant agents (default setup).  
- Separate keys per agent under the same customer license.

### Tenant Integration

Each tenant is linked to an active license.  
When created, the Multi-Tenant Platform associates the tenant with its license and API key(s).  
All usage data is then reported to the License Service for centralized accounting.

---

## 4. Provisioning Flow

### Main Steps

1. **User Registration** – User signs up via the web interface.  
2. **Tenant Creation** – A new tenant record is created and provisioning begins.  
3. **Environment Deployment** – Containers (Core, ASR, LLM, TTS/STS, DB, Network) are deployed via DSAI-APP.  
   Tenant-specific configuration files are generated within the shared Asterisk instance.  
4. **License Association** – Tenant is linked to an existing or newly requested license.  
5. **Access Dashboard** – User can access their DSAI Application environment to manage agents, API keys, and consumption.

---

## 5. Evolution Vision

The proposed architecture supports future scalability and automation goals:

- **Progressive Architecture** – Start from a simple shared setup (single Asterisk, basic Docker deployment), then evolve toward a **scalable distributed system**.  
- **Dynamic Scalability** – On-demand tenant activation and suspension.  
- **Automated Billing** – Real-time credit updates integrated with billing systems.  
- **Central Monitoring** – Unified metrics and performance tracking.  
- **Per-Tenant Asterisk** – Future evolution toward full isolation.  
- **External Provider Integration** – Expand support for new AI voice pipelines.  
- **Advanced API Management** – Implement API key policies, rate limits, and expirations.  
- **SaaS Offering** – In future stages, **Agent Voice Response** may host and provide the **Multi-Tenant Cloud** service directly, offering subscription-based access (monthly or annual fee) tied to **audio traffic volume (POG – Pay on Growth)**.

---

## 6. Conclusion

This architecture defines a **modular, scalable, and future-ready ecosystem** for Agent Voice Response, built around three key principles:

1. **Tenant Isolation** – Each customer operates in a secure, independent environment.  
2. **Automation** – Simplified provisioning and lifecycle management through the Multi-Tenant Platform.  
3. **Central Governance** – License and credit management maintained in the centralized License Service Cloud.

The separation of **Multi-Tenant Platform**, **DSAI Application**, and **License Service** ensures orderly growth, robust security, and the foundation for a fully **SaaS-ready voice AI infrastructure**.
