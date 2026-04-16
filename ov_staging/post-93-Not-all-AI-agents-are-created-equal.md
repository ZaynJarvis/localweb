# Not all AI agents are created equal

- Post ID: 93
- Source: https://www.lennysnewsletter.com/p/not-all-ai-agents-are-created-equal
- Author: Hamza Farooq (www.lennysnewsletter.com)
- Posted at: 2025-05-13T13:03:05.793Z
- Saved at: 2026-04-15 18:30:08
- Tags: ai, agent, must

---

# Not all AI agents are created equal

![cover](/post_images/93_0.jpg)

_👋 Hey there, I’m Lenny. Each week, I answer reader questions about building product, driving growth, and accelerating your career. For more: [Lenny’s Podcast](https://www.lennysnewsletter.com/podcast) | [Lennybot](https://www.lennybot.com/) | [How I AI](https://www.youtube.com/@howiaipodcast) | My favorite [AI/PM courses](https://maven.com/lenny), [public speaking course](https://ultraspeaking.com/lennyslist?via=lenny), and [interview prep copilot](https://www.benerez.com/copilot/lenny)_

_P.S. Get a full free year of Lovable, Manus, Replit, Gamma, n8n, Canva, ElevenLabs, Amp, Factory, Devin, Bolt, Wispr Flow, Linear, PostHog, Framer, Railway, Granola, Warp, Perplexity, Magic Patterns, Mobbin, ChatPRD, and Stripe Atlas [by becoming an Insider subscriber](https://www.lennysnewsletter.com/subscribe?plan=founding). [Yes, this is for real](https://www.lennysnewsletter.com/p/productpass)._

---

Agents are so hot right now. Every other day, someone’s launching a new one or a new tool to manage them. I bet your team has a half-dozen agent ideas on your backlog right now. None of this means you actually need to build an agent today. But it does mean that you need to understand how agents fit into your broader strategy, and what the right investment looks like.

[Hamza Farooq](https://www.linkedin.com/in/hamzafarooq/) and [Jaya Rajwani](https://www.linkedin.com/in/jayarajwani/) teach two of the most highly rated and well-respected courses on building AI agents ([Agent Engineering Bootcamp](https://bit.ly/4mdjIHq) and [Agentic AI for PMs](https://bit.ly/415aF1b)) and spent over 50 hours putting this guide together. **By the time you finish reading this post, you’ll understand the three types of agents, how to decide which initiatives to prioritize, and how to avoid common pitfalls—with specific recommended tools and platforms and tons of real-life examples.**

Let’s get into it.

_P.S. You can listen to this post in convenient podcast form: [Spotify](https://open.spotify.com/show/0IIunA06qMtrcQLfypTooj) / [Apple](https://podcasts.apple.com/us/podcast/lennys-reads/id1810314693) / [YouTube](https://www.youtube.com/@lennysreads)._

---

[

![](/post_images/93_1.png)



](https://substackcdn.com/image/fetch/$s_!0bKY!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Ff7622271-6226-44da-926d-8fbb1e4af173_1456x970.png)

Over the past year, we’ve had the same conversation at least 30 times. An AI leader pulls up their roadmap, usually 5 to 10 “agent” initiatives, and says, “Help us figure out which one to build first.”

The list usually includes a PM assistant, a RAG copilot, a customer support system, a code review agent, and a voice-enabled shopping assistant

If you’re reading this, you probably have a similar list. Your team is energized, investors are asking about it, competitors are announcing agent launches. You need to pick something and ship it.

That’s where most teams get stuck. **The problem isn’t that they lack ideas; it’s that they try to prioritize fundamentally different kinds of systems as if they were the same thing.** The usual approach is to reach for familiar planning tools. Teams open an impact-vs.-effort matrix and try to compare ideas side by side.

But with AI agents, that quickly falls apart. One “agent” might take six weeks to build. Another might take six months. One can be assembled by a product manager using n8n. Another requires a dedicated ML engineering team. One costs $500 per month to operate. Another could generate a six-figure annual LLM bill.

A customer support assistant and a voice-enabled shopping agent may both be called agents, but they demand different architectures, different teams, different infrastructure, and different timelines. Until you recognize those differences, any attempt to compare “effort” or “impact” is essentially guesswork.

Treating architecturally different products as if they’re in the same category makes effective prioritization nearly impossible. Prioritization breaks not because teams are bad at planning but because they’re comparing apples, oranges, and jet engines on the same spreadsheet.

## **The missing step is hierarchy**

Before you can decide which agent to build first, you need to answer a more basic question: **What type of agent is each idea actually proposing?**

This will determine almost everything that matters for planning:

-   How complex it will be to build
    
-   What skills and infrastructure are required
    
-   How long it is likely to take
    
-   How expensive it will be to operate
    
-   How you should measure success
    

In other words, categorization isn’t just a technical exercise. It’s the foundation for smart prioritization.

**This post gives you a decision framework you can start using today with your current roadmap.**

We developed this framework from patterns we’ve seen while helping organizations turn agent ideas into real production systems. Working with enterprise teams across Fortune 500 companies such as Jack in the Box, Tripadvisor, and The Home Depot, we found that grouping ideas by their underlying architecture unlocks prioritization and significantly speeds up the development and launch process. These distinctions also mirror how the broader industry is beginning to classify AI agents, from automation workflows to reasoning systems and multi-agent networks (like the [Levels of Autonomy for AI Agents](https://arxiv.org/abs/2506.12469) paper and [Types of AI agents](https://www.ibm.com/think/topics/ai-agent-types) by IBM). These are also the foundations of how massively popular tools like OpenClaw and Claude Code are actually architected.

If you’re staring at a backlog of agent ideas trying to figure out what to build first, here’s what you’ll have by the end of this post:

1.  **A 5-minute triage process** to categorize every agent idea into one of three architectural types
    
2.  **A guide to picking the right tool/platform** for your project (i.e. when to use n8n vs. LangGraph vs. ADK)
    
3.  **Success metrics and ROI frameworks** tailored to each architectural type
    
4.  **Warning signs** that you’ve picked the wrong path (and how to fix it)
    

You’ll be able to look at your backlog and know which ideas can ship in six weeks for quick ROI, which need three months but will drive significant revenue growth, and which are a six-month bet that only makes sense with the right resourcing and expectation setting.

All by first recognizing that “agent” is an umbrella term for very different kinds of systems.

## **The three agent categories**

Every “agent” idea falls into one of three architectural categories.

[

![](/post_images/93_2.png)



](https://substackcdn.com/image/fetch/$s_!wh-z!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fc2de1ce4-ffb8-4c89-b494-06bcdbb4a163_1456x970.png)

**Category 1: Deterministic automation  
**You define the entire flow. AI handles content at specific steps. Think: n8n or Zapier workflows with LLM nodes. This is where the majority of agent opportunities belong and where most teams should start. These projects are fastest to launch and deliver measurable ROI quickly.

**Category 2: Reasoning and acting agents  
**AI decides what to do next, using available tools. Think: Cursor, Lovable, or agents built with LangGraph, CrewAI, Google ADK, etc. These initiatives typically come after Category 1, when higher-value problems require flexibility and dynamic decision-making that workflows alone can’t handle.

**Category 3: Multi-agent networks  
**Multiple specialized agents coordinate with each other. Think: enterprise systems built with ADK or AutoGen. These projects are typically reserved for later stages, when multiple teams must coordinate across domains, and should almost never be the starting point on a roadmap.

Some examples of “agents” that fit into each category to help you understand the differences:

[

![](/post_images/93_3.png)



](https://substackcdn.com/image/fetch/$s_!IVsO!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fb072fb6f-ba6b-4ea6-b215-e842ba409cf0_1456x1289.png)

Organizations often try to build Category 1 problems with Category 2 frameworks—overengineering solutions that add unnecessary complexity and cost. Less frequently but with worse outcomes, they try to solve Category 2 problems with Category 1 tools, and it breaks in production because the tool is not robust enough.

Let’s take a deeper dive into each category, starting with the workhorse, Category 1.

## **Category 1: Deterministic automation**

### What this is

These are workflows where you define every step, every branch, every decision point. An LLM handles natural language understanding and generation at specific nodes, but you control the flow. Think of them as intelligent flowcharts where you design the path and AI handles the content.

**Tools most commonly used** for deterministic automation are n8n, Zapier, Make.com, OpenAI AgentKit, Lindy, and Gumloop. These tools are built around explicit triggers and predefined branching logic. You define the workflow, while LLMs are used only for classification, extraction, or drafting within those boundaries.

### How to prioritize Category 1 products

If your backlog includes a mix of agent ideas, Category 1 projects are almost always the smartest place to begin. These initiatives tend to be the simplest to plan and the lowest-risk to execute.

They’re best suited to situations where the process is already well-defined and the goal is to automate repetitive, high-volume work. If you need quick, measurable ROI, have limited AI engineering capacity, or are under pressure to deliver results in weeks rather than months, Category 1 projects are almost always the right starting point.

Most initiatives in this category share a similar profile across certain criteria:

[

![](/post_images/93_4.png)



](https://substackcdn.com/image/fetch/$s_!0716!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F6a664ae3-eeae-49ec-b616-ac973a5fece6_1456x970.png)

That combination of fast timelines, modest resources, and clear business impact is what makes Category 1 initiatives such powerful early wins. They generate near-term value while building organizational confidence for more advanced efforts later.

### What types of products fall in this category

If you can map the entire process as a flowchart with clear decision points, a product belongs in Category 1. Here are some more traits of a Category 1 product:

-   Execution paths are finite and predictable (fewer than 15 to 20 branches)
    
-   Task completion needs to happen in seconds to minutes
    
-   The value is in automating a known process, not discovering new approaches
    

In our experience with customers, this covers 60% to 70% of agent opportunities. Revisiting the typical list of opportunities I mentioned above, here is a great example of a Category 1 product: “We need an AI agent to handle incoming customer emails, read them, understand what they’re asking, pull relevant information from our docs, draft replies, and route to our team for approval.”

At first, this sounds like it needs sophisticated reasoning. But when you map out what actually needs to happen, it’s remarkably deterministic:

[

![](/post_images/93_5.png)



](https://substackcdn.com/image/fetch/$s_!BovG!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F6c06485a-4723-44a4-afa9-5e6928817017_1456x1753.png)

Every step is predictable. The “intelligence” is in understanding the email and generating a good response, not in figuring out what to do next. This is Category 1.

There are a ton of great examples of automation agents; [here’s](http://airbnb.traversaal.ai) one built by me.

I love Airbnb, but I hate spending long hours finding the best ones, so I built an agent that will take my exact request for, e.g., “Modern apartment in Paris near train stations from 20th March to 26th March. Great for a couple” (more than 10,000 users have used it) and run a search. [Here’s](https://github.com/traversaal-ai/agents-in-action/tree/main/airbnb-agent) how you can build your own.

[

![](/post_images/93_6.gif)



](https://substackcdn.com/image/fetch/$s_!_kvu!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fd27ebbfa-6a53-4c37-8dcd-f824548d575d_1456x785.gif)

[

![](/post_images/93_7.png)



](https://substackcdn.com/image/fetch/$s_!SZG_!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fb3ebd07b-4809-4ec6-8ac0-2c00e7bdad88_1456x864.png)

**Other examples of Category 1 “agents”:**

-   a travel planning agent
    
-   a voice-enabled book companion agent
    
-   a content automation agent (YouTube → LinkedIn)
    
-   a knowledge base of your organization with internet search (Perplexity clone)
    
-   an agent that generates deeply researched blogs, based on a given topic
    
-   a highly personalized calorie counter app that allows you to upload images of your meals to keep track of your daily caloric intake and recommends better dietary choices and exercises
    

### How to evaluate Category 1 products

The metrics below are designed to answer a simple question: Did this agent automate the right process, or should this idea be reconsidered or re-scoped?

A deterministic agent built for the email automation process can be evaluated as follows:

-   **Workflow completion rate:** % of executions that finish successfully
    
-   **Automation rate:** % of requests handled without human intervention
    
-   **Accuracy:** correctness of intent classification, data extraction, and routing decisions
    
-   **Latency:** time from trigger to final output (P50/P95 if relevant)
    
-   **Cost per workflow:** total LLM and API cost per completed run
    
-   **Error rate:** % of runs failing due to tool, integration, or system errors
    
-   **Human review rate:** % of runs requiring manual approval or intervention
    

Here are workflow completion rate metrics from a real-life example of a Category 1 product, an email support agent built by a SaaS company we worked with:

-   **Week 1:** 52% completion rate (lots of edge cases discovered)
    
-   **Week 4:** 78% completion rate (refined classification logic)
    
-   **Week 8:** 87% completion rate (stable, production-ready)
    
-   **Result:** 3,000 support emails/month automated, 2.5 FTE hours/day freed, $18K/month savings
    

When these metrics stabilize and cost trends downward, the workflow is doing what it should. If completion remains low or manual intervention stays high, the problem may not be deterministic enough for this category.

### How to know you’ve outgrown Category 1

You’ll know you need a different architecture when:

1.  Your flowchart has 30+ nodes and you’re adding new branches every week
    
2.  Customers phrase things in ways you can’t anticipate, and mapping all variations is impossible
    
3.  The agent needs to decide _which_ API or knowledge source to use based on context, not follow a predetermined path
    
4.  Breaking down ambiguous requests requires exploration and adaptation, not predefined decomposition
    
5.  The highest-value opportunities can no longer be expressed as predictable workflows
    
6.  Most quick-win processes are already automated
    

If several of these signals are present at once, the problem is no longer a good fit for a deterministic workflow, and you should consider Category 2.

## **Category 2: Reasoning and acting agents (ReAct)**

### What this is

Instead of defining the flow, you define the _available tools_, and an LLM autonomously decides what to do next. The agent operates in a loop: observe → reason → act → observe result → repeat.

The key characteristic: **you control the tools; the LLM controls the reasoning.**

**Tools most commonly used** for building ReAct agents include LangGraph, CrewAI, AutoGen, and other agent orchestration libraries that support tool use, memory, and dynamic planning.

[

![](/post_images/93_8.png)



](https://substackcdn.com/image/fetch/$s_!JUSF!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F19f431ae-bf87-4b50-8e49-d7ad6d452f0c_1424x1449.png)

### How to prioritize Category 2 products

Category 2 is for situations where user requests are ambiguous, workflows cannot be mapped in advance, and real value comes from flexible, contextual decision-making. If you need agents that can reason across multiple tools, handle conversational interactions, or adapt dynamically to new inputs, that’s a Category 2 product.

Category 2 products are more complex to plan and carry higher execution risk than Category 1. Most initiatives in this category share a similar profile:

[

![](/post_images/93_9.png)



](https://substackcdn.com/image/fetch/$s_!LfM9!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F1d3d9c7e-88d3-4488-bc45-10fe38027f6b_1456x970.png)

The combination of longer timelines, specialized expertise, and higher costs is what makes Category 2 initiatives powerful but more demanding than Category 1. If your backlog includes problems that truly require reasoning and dynamic behavior, prioritizing Category 2 projects becomes essential. They unlock use cases that deterministic automation cannot handle and enable more advanced, high-impact agent experiences.

### What types of products fall in this category

A product belongs in Category 2 if the same user request can trigger different action sequences every time. That means that you don’t determine the path; the LLM does. That’s the key difference from Category 1. Here are some more traits of a Category 2 product:

-   The same high-level task requires different sequences of actions depending on input
    
-   You have 5-15+ distinct capabilities and the right one depends on context
    
-   User intent is ambiguous and needs clarification through interaction
    
-   Multiple input modalities (voice, image, text) need to be understood contextually
    
-   Breaking down complex requests into sub-tasks is part of the value
    

In our work with customers, this is the right choice for 25% to 30% of agent opportunities. For an example of this type of product, let’s return to the voice-enabled shopping assistant opportunity from the start of this post.

Customers should be able to search products by voice, upload images to find similar items, check order status, update preferences, and initiate returns, all through conversation.

At first, this sounds like Category 1. Just map out the intents and route accordingly, right? But in practice, real conversations don’t follow fixed paths. To see why, let’s walk through one interaction.

A customer uploads a photo of shoes and says:  
_“These are too small. I need a size up, and I want them delivered by Thursday.”_

Here’s what happens under the hood:

1.  **Observe.** The agent receives mixed input: an image + voice request.
    
2.  **Reason.** It determines:
    
    -   First, identify the product in the image
        
    -   Then, find available size variants
        
    -   Then, check delivery dates
        
    -   Finally, confirm the order with the user
        
3.  **Act.** The agent dynamically selects tools:
    
    -   **visual\_search()** → identify product
        
    -   **check\_inventory()** → find size-up availability
        
    -   **get\_delivery\_options()** → verify Thursday delivery
        
    -   **place\_order()** → after confirmation
        
4.  **Observe result → reason again.** Each tool response updates the agent’s state and influences the next step.
    

This sequence cannot be pre-defined.

-   If the item is out of stock, the agent may suggest alternatives.
    
-   If Thursday delivery isn’t available, it may propose pickup.
    
-   If the image can’t be recognized, it asks a clarifying question.
    

The same user request triggers different action sequences based on reasoned considerations.

[

![](/post_images/93_10.png)



](https://substackcdn.com/image/fetch/$s_!Plu-!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fc2ceaeb2-37c7-48a5-b3ab-e3a726bb633f_1456x1382.png)

Other examples of Category 2 “agents”:

-   a conversational customer support agent
    
-   a code assistant that modifies repositories, e.g. Claude Code
    
-   an intelligent personal shopping assistant
    
-   an IT troubleshooting agent
    
-   a sales copilot that researches accounts and drafts outreach
    
-   a multimodal assistant combining voice, image, and text
    

### How to evaluate Category 2 products

Reasoning agents should be evaluated on whether they help users achieve their goals across variable paths, while remaining efficient enough to justify their cost.

These metrics answer the question: Was dynamic reasoning necessary, or should the problem be simplified to a lower category?

-   **Task completion rate:** % of sessions where users achieve their intended goal
    
-   **Reasoning accuracy:** correctness of task decomposition, tool selection, and decision ordering
    
-   **Conversation length:** average turns to resolution
    
-   **Multimodal accuracy:** correctness of image, voice, or structured input interpretation (if applicable)
    
-   **Tool call efficiency:** average number of tool calls per successful session
    
-   **Latency:** time per turn and end-to-end session duration
    
-   **Cost per session:** total LLM and API cost per completed interaction
    
-   **User satisfaction:** post-interaction CSAT or equivalent signal
    
-   **Business impact:** lift in conversion, retention, or task success versus baseline
    

Here are some metrics from a real-life example, a voice + image shopping assistant for a home goods retailer we built:

-   **Month 1:** 71% task completion, longer conversations, higher tool usage, $0.12 cost per session
    
-   **Month 4:** 86% task completion, shorter conversations, fewer tool calls, $0.08 cost per session
    

Result: Image identification accuracy improved from 76% to 91%, conversion lift increased from +8% to +22%, and CSAT rose from 4.0 to 4.5.

When task completion improves while conversation length, tool usage, and cost per session decline, the agent’s reasoning loop is adding value. If performance stalls while costs remain high, the problem may be over-scoped or better served by the deterministic approach of Category 1 tools.

### How to know you’ve outgrown Category 2

You’ll know you need a different architecture when:

1.  Your single agent is trying to handle too many domains (customer service + inventory + logistics + finance) and performance is degrading
    
2.  You need agents to delegate tasks to each other, not just call stateless APIs. Example: A shopping agent needs to ask an inventory agent, “Can you check all warehouses and suggest alternatives?”
    
3.  Tasks take hours or days to complete (like the automated eval agent analyzing 10,000 conversations overnight)
    
4.  You need hundreds of agent instances running in parallel, coordinating work among them
    
5.  Different teams want to own their specialized agents, but they need to work together
    

If you’re hitting two to three or more of these, it’s time to consider Category 3 tools and approaches.

## **Category 3: Multi-agent network**

### What this is

Instead of one agent calling tools, you have multiple specialized agents that coordinate with each other. Each agent is owned by a different team, handles its own domain, and can request help from other agents.

The key characteristic of Category 3: agents delegate to other agents, not just APIs.

**Category 2 vs. Category 3—what’s the difference?**

-   Category 2: One shopping agent calls an inventory API to check stock
    
-   Category 3: Shopping Agent asks Inventory Agent, “Can you check all warehouses and suggest alternatives?” → Inventory Agent then asks Logistics Agent, “Can we deliver from warehouse B by Thursday?”
    

Each agent in the network is itself a reasoning system that can break down requests, but they coordinate by delegating complex tasks to each other rather than trying to handle everything themselves.

In practice, your shopping agent doesn’t need to know how inventory forecasting works; it just needs to find and communicate with the Inventory Agent owned by the ops team. When ops improve their agent, shopping automatically benefits.

For Category 3 projects, you can still use the same frameworks used to build individual reasoning agents, but they need to be combined with additional coordination layers, such as Google’s A2A protocol for structured agent-to-agent delegation and enterprise orchestration systems like Temporal, Kafka, or Step Functions for discovery, routing, and long-running workflows.

### How to prioritize Category 3 products

Category 3 is almost never the starting point on a roadmap. It becomes relevant only when organizations already operate multiple production agents and need them to work together.

That’s because Category 3 initiatives represent the most complex and resource-intensive type of agent work. A typical effort in this category involves:

[

![](/post_images/93_11.png)



](https://substackcdn.com/image/fetch/$s_!9YF1!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F53789e63-cab9-484f-bf55-1ebbdff8b576_1456x1110.png)

Most organizations should only invest in Category 3 projects after they have already succeeded with Category 1 and Category 2 initiatives. A single orchestrator agent (Category 2) is usually simpler and more effective until true cross-team coordination becomes unavoidable.

### What types of products fall in this category

Traits of Category 3 products include:

-   Multiple teams need to build and own specialized agents
    
-   Agents need to operate asynchronously over hours or days
    
-   No single agent can handle the required breadth of capabilities
    
-   The system needs to scale to hundreds of concurrent agent instances
    
-   New agents need to be added without redeploying everything
    

Multi-agent networks are still uncommon today, used by fewer than 5% to 10% of teams building agents. We expect adoption to increase over the next 12 to 24 months as more companies will have multiple teams independently deploying production agents, making coordination unavoidable.

We’re starting to see more multi-agent networks emerge with Fortune 500 retailers and food chains we work with in the U.S. These organizations have separate teams that want to build specialized agents for:

-   Customer service (returns, inquiries, order status)
    
-   Shopping assistance (product discovery, recommendations)
    
-   Inventory management (stock checking, reordering)
    
-   Logistics coordination (delivery scheduling, route optimization)
    
-   Quality monitoring (the eval agent that monitors all others)
    

But these agents need to work together to accomplish important workflows:

-   Shopping agent discovers customer wants something out of stock → delegates to inventory agent to check other locations
    
-   Inventory agent sees recurring stockouts → delegates to logistics agent to adjust reorder schedules
    
-   Customer service agent notices a spike in complaints → delegates to quality agent to investigate
    
-   Quality agent finds an issue with shopping agent → reports to monitoring system
    

No single team can build all this. Each agent needs to evolve independently. But they need to coordinate to meet the product opportunities.

That’s Category 3.

[

![](/post_images/93_12.png)



](https://substackcdn.com/image/fetch/$s_!1dEO!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Ff43c07db-a466-4e28-a316-264275e38704_1456x1613.png)

### How to evaluate Category 3 products

Category 3 systems succeed if many independent agents can work together without creating fragility. To evaluate their performance, it’s best to focus on five signals:

-   **Agent uptime:** % of time each agent is available
    
-   **Cross-agent success rate:** % of multi-agent collaborations that complete successfully
    
-   **Discovery success rate:** % of agent lookups that find the right agent
    
-   **End-to-end latency:** P50, P95, P99 for tasks requiring multiple agents
    
-   **Cost per complex task:** Sum of all LLM calls across agents
    
-   **Team velocity:** Time to add new agent or capability
    

Here’s how Category 3 metrics worked in a real-life example, where a **large retailer deployed a multi-agent network spanning customer service, inventory, logistics, and quality monitoring**:

-   Early deployment:
    
    -   Agent uptime: 97%–98% per agent
        
    -   Cross-agent success rate: 72% of multi-agent workflows completed successfully
        
    -   Discovery success rate: 81% correct agent routing
        
    -   End-to-end latency: P50 1.8s, P95 6.4s, P99 14.2s
        
    -   Cost per complex task: $1.85
        
    -   Team velocity: 6–8 weeks to add a new agent
        
-   Stabilized deployment:
    
    -   Agent uptime: >99.5% per agent
        
    -   Cross-agent success rate: 91% completion
        
    -   Discovery success rate: 94% correct routing
        
    -   End-to-end latency: P50 1.6s, P95 4.9s, P99 7.8s
        
    -   Cost per complex task: $1.92 (stable despite more agents)
        
    -   Team velocity: 2–3 weeks to add a new agent
        

Result: Additional agents and teams were introduced without degrading reliability, latency tails, or per-task cost.

When cross-agent success rates and latency percentiles remain stable as new agents are added, and cost per complex task grows slowly or stays flat, a multi-agent network architecture makes sense for this product. If failure rates, tail latency, or integration time spike with each new agent, the system is likely over-coordinated or prematurely complex. You can try looking at Category 1 or Category 2 architecture instead.

## **Your decision framework: choosing the right category**

Here’s the systematic process for deciding which category your agent opportunity requires.

[

![](/post_images/93_13.png)



](https://substackcdn.com/image/fetch/$s_!YEur!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fec1278fb-34f7-49a5-8151-1354b468b303_1456x1034.png)

### **The 5-minute triage**

For each agent idea in your backlog, ask these questions:

[

![](/post_images/93_14.png)



](https://substackcdn.com/image/fetch/$s_!o_n_!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F851fcfa5-16eb-42f2-9a5e-f84e4e94e2c6_1456x2145.png)

### What if you choose the wrong category?

In practice, teams won’t always get this perfectly right, and that’s OK. The goal of the triage isn’t to guarantee a flawless decision on day one. It’s to help you make the best initial bet with the information you have, and then adjust quickly based on real-world signals.

If you start in the wrong category, the signs usually show up fast:

-   A Category 1 project that keeps growing branches and edge cases is likely a Category 2 problem
    
-   A Category 2 agent that mostly follows fixed patterns might have been simpler and cheaper as Category 1
    
-   A Category 3 design that requires heavy coordination for little added value is often better reduced to Category 2
    

The key is to treat categorization as a living decision, not a permanent label. Pilot early, measure honestly, and be willing to refactor the architecture when the evidence points elsewhere. Choosing the “wrong” category for a few weeks is far less costly than never having a clear framework at all.

## **Real-world systems: where architectures converge**

In reality, production agentic systems rarely commit to a single paradigm. Two of the most widely studied examples are OpenClaw and Claude Code.

[OpenClaw](https://www.lennysnewsletter.com/p/openclaw-the-complete-guide-to-building) is primarily a ReAct agent. It runs a continuous loop of reasoning, tool selection, and action across messaging platforms like WhatsApp and Telegram. But users can configure multiple specialized agents to coordinate on complex tasks, pushing it into multi-agent territory when the problem demands it.

Claude Code goes further. At its core is a ReAct reasoning loop—the model decides what to do, calls a tool, observes the result, and continues. Layered on top is a deterministic hooks system that fires scripts at lifecycle events like saving files or running shell commands, without involving the LLM at all. And when a task is too large or risky for one context window, it spawns sub-agents with isolated contexts that coordinate through a structured approval pattern.

Neither system is purely deterministic, purely ReAct, or purely multi-agent. They’re layered—each paradigm solving a specific failure mode the others can’t. Deterministic for auditability. ReAct for flexible reasoning. Multi-agent for parallelism and isolation.

That’s the real design decision: not which architecture to pick, but knowing when your problem has outgrown one layer and needs the next.

## **The path forward**

This framework isn’t the only way to think about agent architectures. But it has proven useful for teams facing a backlog of “agent” ideas, trying to figure out what to build first and how to sequence investments.

The key insight: not all agents are created equal. A deterministic automation, a reasoning agent, and a multi-agent network require completely different architectures, timelines, budgets, and expertise. Treating them the same is why so many initiatives stall and why prioritization often feels impossible.

This is where categorization becomes a roadmap tool. Once ideas are grouped by category, prioritization follows naturally:

-   Category 1 initiatives are fastest to launch and deliver ROI quickly, making them the best starting point
    
-   Category 2 initiatives come next, when higher-value problems require reasoning and flexibility
    
-   Category 3 initiatives are reserved for situations where cross-team coordination is truly necessary
    

In other words, the categories define the order—start simple, prove value, and increase sophistication only when the problem demands it.

The teams shipping successful agent systems are the ones who can quickly assess which category their problem requires and resist the temptation to over-engineer.

Three questions to ask for every agent idea:

-   Which category does this problem actually need? (Use the 5-minute triage.)
    
-   Do we have the infrastructure and expertise for this category? (Be honest about readiness.)
    
-   What’s the measurable ROI, and how will we know if it’s working? (Define success metrics before building.)
    

If you can’t answer all three clearly, you’re not ready to start building. And that’s fine. Better to start with a Category 1 automation that ships in six weeks and delivers measurable value than to launch a Category 3 multi-agent system that’s still “90% done” after six months.

That’s how this framework helps with prioritization: it turns a confusing list of “agents” into a clear, practical sequence of what to build now, what to build next, and what to leave for later.

_Thanks, Hamza and Jaya!_

_Have a fulfilling and productive week 🙏_

---

**If you’re finding this newsletter valuable, share it with a friend, and consider subscribing if you haven’t already. There are [group discounts](https://www.lennysnewsletter.com/subscribe?group=true), [gift options](https://www.lennysnewsletter.com/subscribe?gift=true), and [referral bonuses](https://www.lennysnewsletter.com/leaderboard) available.**

Sincerely,

Lenny 👋