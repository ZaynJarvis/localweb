# OpenClaw: The complete guide to building, training, and living with your persona

- Post ID: 92
- Source: https://www.lennysnewsletter.com/p/openclaw-the-complete-guide-to-building
- Author: Claire Vo (www.lennysnewsletter.com)
- Posted at: 2025-05-13T13:03:05.793Z
- Saved at: 2026-04-15 18:30:02
- Tags: ai, agent, vibe-coding, skim

---

# OpenClaw: The complete guide to building, training, and living with your personal AI agent

![cover](/post_images/92_0.jpg)

_👋 Hey there, I’m Lenny. Each week, I answer reader questions about building product, driving growth, and accelerating your career. For more: [Lenny’s Podcast](https://www.lennysnewsletter.com/podcast) | [Lennybot](https://www.lennybot.com/) | [How I AI](https://www.youtube.com/@howiaipodcast) | My favorite [AI/PM courses](https://maven.com/lenny), [public speaking course](https://ultraspeaking.com/lennyslist?via=lenny), and [interview prep copilot](https://www.benerez.com/copilot/lenny)_

_P.S. Get a full free year of Lovable, Manus, Replit, Gamma, n8n, Canva, ElevenLabs, Amp, Factory, Devin, Bolt, Wispr Flow, Linear, PostHog, Framer, Railway, Granola, Warp, Perplexity, Magic Patterns, Mobbin, ChatPRD, and Stripe Atlas [by becoming an Insider subscriber](https://www.lennysnewsletter.com/subscribe?plan=founding). [Yes, this is for real](https://www.lennysnewsletter.com/p/productpass)._

---

> **“OpenClaw is probably the single most important release of software, probably ever.” —Jensen Huang, Nvidia CEO**

Claire Vo has put together the definitive step-by-step guide to getting started with and mastering OpenClaw. Building on our [podcast episode](https://www.youtube.com/c/LennysPodcast), this post covers everything you need from first install to running a full team of AI agents, plus the specific use cases that have changed her life. Whether you’re brand new to OpenClaw or already running one, Claire’s guide will level you up.

_A big thank-you to [Peter Steinberger](https://x.com/steipete?lang=en), [Dave Morin](https://x.com/davemorin), and [Nat Eliason](https://x.com/nateliason) for reviewing drafts of this post. For more from Claire, check out her podcast [How I AI](https://www.youtube.com/@howiaipodcast) and [ChatPRD](https://www.chatprd.ai/), and find her on [X](https://x.com/clairevo) and [LinkedIn](https://www.linkedin.com/in/clairevo)._

[

![](/post_images/92_1.png)



](https://substackcdn.com/image/fetch/$s_!UV3b!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F828cd7bf-7e57-4cc3-bb72-2bcbbf5cac9e_2912x1940.png)

At 6 a.m., before I’ve looked at my phone, an AI agent named Polly has already read my email, checked my calendar, and queued up my day. By the time I sit down for coffee, another agent has reminded my husband about spirit day at school. A third AI is halfway through drafting a sales email, which will land in our prospect’s inbox three minutes after they contact us. One of the agents even helped draft this paragraph (though the rest was lovingly written by my human hands).

[

![](/post_images/92_2.png)



](https://substackcdn.com/image/fetch/$s_!a38x!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fb8fd4dc5-83af-4a21-a7b3-830aad02efac_1456x1256.png)

None of this existed three months ago.

If you’re paying attention to AI news, you’ve probably heard about [OpenClaw](https://openclaw.ai/). For a while, it seemed like X was nothing but lobster emojis and breathless posts about _everything_ it can do: [running your business](https://creatoreconomy.so/p/use-openclaw-to-build-a-business-that-runs-itself-nat-eliason), [buying cars](https://aaronstuyvenberg.com/posts/clawd-bought-a-car), planning the AI uprising [with its friends](https://x.com/karpathy/status/2017296988589723767?s=20), and more. You’ve also probably seen some horror stories, like when it started deleting [this user’s full Gmail inbox](https://www.reddit.com/r/technology/comments/1rckxu7/meta_director_of_ai_safety_allows_ai_agent_to/), or that time [it completely screwed up my own personal calendar](https://x.com/clairevo/status/2015555956005011866).

You’re interested, and a little scared. I was too. But the idea of a dedicated personal assistant that could help run my life and businesses was so appealing that I had to dig in. The more I play with OpenClaw, the more convinced I am that it is one of _the_ most powerful AI tools for personal use, and a sign of where these tools are going.

Fast-forward two months, I’m chatting 24/7 with my nine (and counting!) OpenClaw agents, which operate my businesses, write code, close sales deals, and make sure I get to my kids’ basketball games on time.

[

![](/post_images/92_3.png)



](https://substackcdn.com/image/fetch/$s_!lK8_!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F8d57c3b4-92ff-4c43-8e29-90ebb73fcbea_1456x1080.png)

My OpenClaw agents in Telegram

OpenClaw is powerful but a little tricky to set up. After a lot of trial and error, I figured out how to make it work—and make my Claws work for me. Here’s exactly how you can too:

## First, what is OpenClaw?

OpenClaw is an open-source personal AI assistant that is more powerful, more autonomous, and more fun to use than anything else I’ve tried. To tell it what needs to be done, you can message it easily on the platforms you already use, like WhatsApp, Telegram, Slack, etc. Then it can control your computer and take care of tasks just as you would, working on its own schedule—even overnight. It’s always on, runs locally, and it can build its own new skills. Teach it once; it handles the rest.

Practically, this means I can text my OpenClaw something like **“Let’s make sure our website always has the latest reasons why we’re better than competitors.”** It will use web search, our GitHub repo, and public APIs to find the information it needs, and ship PRs with the updates. Every week, it will refresh those pages with new data based on new features or market news.

One text turns into an always-on agent. But how you set it up is important, and understanding a few key concepts will save you tens of hours of frustration.

Key OpenClaw concepts:

-   It runs a **local gateway** that takes in messages. Think of this as a general-purpose inbox that can receive instructions from any **channel** (e.g. terminal, Telegram, WhatsApp, etc.)
    
-   Behind this gateway are **agents**, which have their own identities, tools, and workspaces
    
-   Agents work on a scheduled set of **cron jobs** and a **heartbeat** that gets checked every 30 minutes
    
-   It can use (and self-install!) **skills**, **APIs**, and **CLIs** to interact with systems and the outside world
    
-   It’s deployed on an owned **machine**, like a Mac Mini or a **VPS** on the cloud that you own and operate yourself
    

I’ve written in detail about the mechanics of OpenClaw [here](https://x.com/clairevo/status/2017741569521271175). The [docs](https://docs.openclaw.ai/) site is also very helpful, especially these top-level pages on channels, agents, and tools:

[

![](/post_images/92_4.png)



](https://substackcdn.com/image/fetch/$s_!n-U1!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F5790d73f-4f41-4a59-88d3-19bd0978924c_1456x1311.png)

But enough theory. Let’s set up your sentient virtual lobster.

## Setting up your first OpenClaw

### What computer to use, and do you need a Mac Mini?

You have options for where to install your OpenClaw, but most importantly, **do not install it on a work or personal computer that’s actively in use. This is very dangerous.** OpenClaw can technically have access to all the files on the computer it runs on, and no matter how careful you are, you don’t want to risk deleting everything, or emailing your personal files to an unsavory character.

The OpenClaw team has done a great job of hardening security, but it’s best to start with an isolated box.

You have three safe options for installing OpenClaw:

1.  **Sign up for a hosted version of OpenClaw.** Startups are popping up every week that make this easy to do. Some of the more popular options include [StartClaw](https://startclaw.com/), [MyClaw](https://myclaw.ai/), [SimpleClaw](https://www.simpleclaw.com/), [UniClaw](https://uniclaw.ai/), and Every’s [Plus One](https://every.to/plus-one). I experimented with a few of these, and they are slick, but I always got stuck on something. These products will get better, and I expect this to be how most people will experience OpenClaw over time.
    
2.  **Have it run in a virtual private server.** This may be the cheapest option, but it’s also the most complicated. Some of the more popular options include [Railway](https://railway.com/deploy/openclaw), [Hostinger](https://www.hostinger.com/vps/docker/openclaw), [DigitalOcean](https://www.digitalocean.com/community/tutorials/how-to-run-openclaw), [Google Cloud](https://docs.openclaw.ai/install/gcp), and [Render](https://docs.openclaw.ai/install/render). I didn’t try going this route, but many technical people prefer it, because it’s quick, powerful, and doesn’t require new hardware.
    
3.  **Use a laptop or (yes) a Mac Mini.** I started with an old MacBook Air and eventually moved to a stack of Mac Minis.
    

[

![](/post_images/92_5.jpg)



](https://substackcdn.com/image/fetch/$s_!yRld!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Ffa0559ea-fa46-4254-b942-3067a9c1d538_1116x1234.png)

You don’t actually have to run it on a [Mac Mini](https://www.apple.com/mac-mini/)—you can use any computer, even an old laptop—but the Mac Mini is simple, powerful, and compact. And it’s kind of become a meme. This option is the most expensive, at least up front, and time-consuming, but also the most fun, educational, and cute!

If you can swing it, I’d try this. (I got the lowest-end model: M4, 16GB, 256GB, about $600.) Just remember to grab a keyboard, mouse, and a monitor for your initial setup. Use whatever you have lying around; you won’t need it again after everything is running.

### Your pre-work

OK, you’ve got your machine booted up. Before we install the Claw, here are a few quick things that will make setup easier (this will take you about 10 minutes):

1.  Set up a fresh admin account and password on the computer you’ll be using
    
2.  [Sign up for a Gmail address](https://accounts.google.com/signin) for your agent (later, you can give it _read-only_ access to your calendar)
    
3.  Make sure [Chrome](https://www.google.com/chrome/) is installed, which is OpenClaw’s preferred browser
    

### Installing OpenClaw

#### Opening the terminal and installing OpenClaw

Open the terminal (_Command ⌘ + Space, type “Terminal,” hit Return_), and run:

> **curl -fsSL https://openclaw.ai/install.sh | bash**

This will install everything you need and drop you into the onboarding. If you get stuck, install [Claude Code](https://code.claude.com) and/or [Codex](https://developers.openai.com/codex/cli) and ask for help!

### Onboarding

Once the install is complete, OpenClaw will walk you through a guided onboarding flow step-by-step. The first step is acknowledging a security warning. Read this!

[

![](/post_images/92_6.png)



](https://substackcdn.com/image/fetch/$s_!Zm-W!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F12b699ed-042c-4c23-a4a5-8a95a9e60483_1456x1612.png)

If you’re ready for the adventure, you can continue through the onboarding. Here are my pro tips for the key steps:

#### Know how to navigate the terminal

If you’re not familiar with working in the terminal, the onboarding process is a little confusing. Use arrow keys to navigate up, down, left, and right, spacebar to select, and enter to submit.

#### Pick your default model

I recommend Claude Opus 4.6 or Codex 5.4 (or whichever model is the most powerful at the time you’re reading this).

#### Authenticate your model provider

You have two options for using paid models like Opus or Codex:

**1\. Use an existing subscription** by logging in to your Claude or ChatGPT account.

_Note_: There are some rumors that Anthropic is banning people who reuse their Claude accounts for OpenClaw. When using any third-party account with OpenClaw, review the terms of service and proceed at your own discretion.

**2\. Use an API key**, which you can get by setting up a developer account at [Claude](https://platform.claude.com/) or [OpenAI](https://platform.openai.com). This is the recommended path, and what I use.

[

![](/post_images/92_7.png)



](https://substackcdn.com/image/fetch/$s_!Mp_g!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fbb3de89a-ecb4-455a-af34-5d88ed4d2f68_1456x480.png)

#### Choose a channel to “talk” to your agent

The best beginner-friendly channel is Telegram. More on this below.

[

![](/post_images/92_8.png)



](https://substackcdn.com/image/fetch/$s_!h62X!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F93c235b4-7bd0-4c88-b72c-fd078feb5c11_1456x895.png)

#### Set up web search

This will give your Claw access to the internet. You can skip and set this up later when you need it.

[

![](/post_images/92_9.png)



](https://substackcdn.com/image/fetch/$s_!4cZD!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F44b7bba5-7b70-4bda-b8cf-b05974af82c4_1456x683.png)

#### Install skills from a list of bundled defaults

I recommend the **gog** skill for Gmail, Google Calendar, and Docs access and **summarize** to start.

[

![](/post_images/92_10.png)



](https://substackcdn.com/image/fetch/$s_!M3EN!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fe03f1d0f-a09d-4b8f-8459-3ad1a345c4a1_1456x1290.png)

#### Enable hooks

These are helpful tools that keep your OpenClaw setup optimized. I turned on all four of these, but **session memory** is the most important. The others are helpful when you want to debug or optimize your agent.

[

![](/post_images/92_11.png)



](https://substackcdn.com/image/fetch/$s_!ZLtu!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fd718987e-6a49-4bda-89c0-b8a3684c00f5_1456x685.png)

Then your agent will “hatch” in the TUI (Terminal UI). Hello, world!

[

![](/post_images/92_12.png)



](https://substackcdn.com/image/fetch/$s_!lIy_!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F08f8f0f4-4d1b-400d-86b1-3da5748b50d5_1456x861.png)

### Setting up Telegram

You’ll want a better chat interface than the terminal, so open up your phone and download [Telegram](https://telegram.org/), a messaging app and the simplest way to connect with your OpenClaw. If you ask OpenClaw, it can walk you through [the setup steps](https://docs.openclaw.ai/channels/telegram), including messaging the @BotFather (yes, really).

## Your first chat

Setting up your agent is where you should put on your manager hat. Just like an employee, it can’t be good at _everything_, so think about a specific job for your OpenClaw. Personal assistant? Social media manager? Engineering intern? Start with one idea and you can always add on more later. If you’re unsure where to start, begin with a personal assistant like I did.

This is where things get fun. Once your OpenClaw is hatched, it will start asking you about yourself and itself to build its definitions and operating model.

You should make sure to share:

1.  Your name
    
2.  Your role/job
    
3.  Common admin challenges in your life (scheduling, remembering tasks, coordination with your family)
    

[

![](/post_images/92_13.png)



](https://substackcdn.com/image/fetch/$s_!2tqx!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fd692c8e7-30d8-44b6-9f17-3e774bcb38b4_1456x907.png)

All this gets written down by the agent and stored in the workspace folder you set up in onboarding (usually _**.openclaw/\[agent\_name\]-workspace**_) as Markdown files.

Those files become your agent’s identity and operating system. They are read every time your OpenClaw starts up and give your agent everything it needs to do a good job. It’s fun to look at these files; occasionally, you may need to go in and edit them.

-   **AGENTS.md**—OpenClaw’s core set of instructions and memory
    
-   **SOUL.md**—Your agent’s persona, tone of voice, and clear boundaries
    
-   **IDENTITY.md**—Your agent’s name, vibe, and personal emoji
    
-   **TOOLS.md**—Notes on tools and how your agent should use them
    
-   **USER.md**—All about you, your OpenClaw’s human
    

[

![](/post_images/92_14.png)



](https://substackcdn.com/image/fetch/$s_!rf-H!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F6fd30a11-1092-4880-8b75-c8c588ee1e04_1456x850.png)

Once its identity and role is set, it should ask you to get started on a first task. Time to Claw!

## How I AI: my personal OpenClaw setup

OK, so you finally have this bot set up. What do you actually _do_ with it?

### Six easy and useful OpenClaw workflows

I do a _lot_ with my OpenClaw agents now, but below are some easy places to start. Just copy and paste these prompts and OpenClaw will do the rest.

#### 1. Coordinate a busy weekend

> _Every Friday, group message me and my husband to confirm the kids’ weekend activity logistics. If there is a conflict, confirm who will pick up each kid and any adjustments we may need to make to lunch or dinner plans. Ask us to explicitly confirm the plan and update our shared family calendar._

[

![](/post_images/92_15.jpg)



](https://substackcdn.com/image/fetch/$s_!KUDd!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F30a44790-cb24-4cf8-bab5-71e97eaac8bb_866x1214.png)

#### 2. Find trending topics and generate memes for social media

> _Every morning, search for trending Reddit topics (r/funny, r/technology) about product management. Use the [MemeLord API](https://www.memelord.com/docs) to generate one image and one video meme, send it to me for approval, then post to TikTok._

[

![](/post_images/92_16.jpg)



](https://substackcdn.com/image/fetch/$s_!wEIV!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F8832b2ec-5cf1-484b-b66d-a72a376c5db0_1600x1419.png)

#### 3. Look through PLG sign ups for high value enterprise prospects, enrich and follow up

> _Every morning, look through the signups for the last 24 hours. Find everyone who signed up with a company domain, and categorize into high-value prospects based on our ideal customer profile. For ones with < 1,000 employees, send a light-touch email based on SALES\_PLAYBOOK.md. For companies with > 1,000 employees, enrich their profile with Exa People API and confirm with me before sending._

[

![](/post_images/92_17.jpg)



](https://substackcdn.com/image/fetch/$s_!5gzx!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F4c80d510-1519-48be-a6a0-a5bfc6a68b73_978x932.png)

#### 4. “Just in time” meeting prep

> _Check all my calendars for any meetings starting in the next 30 minutes. If there is a meeting starting soon, send me a pre-meeting brief on Telegram. Include meeting title and time, who’s attending, and agenda if available from the calendar event description, and our last interaction based on the most recent email thread or meeting notes with this person/company._

[

![](/post_images/92_18.jpg)



](https://substackcdn.com/image/fetch/$s_!ue5f!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fc99af76b-50b6-43f2-86b0-821a057654a2_708x986.png)

#### 5. Write support docs overnight

> _Every Friday evening, look over our resolved support tickets. If any question has been asked 3+ times this week: (1) flag it as a docs/FAQ candidate, (2) create a Linear issue and assign to @agent to add a docs page to/docs covering the answer, (3) include the standard answer you’ve been giving as a starting point in the issue description._

[

![](/post_images/92_19.png)



](https://substackcdn.com/image/fetch/$s_!u5P0!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F933989bc-7cf9-4a39-84a7-7efc70c76878_950x1154.png)

#### 6. Project manage me

> _I have a project launching on <date>. Keep a to-do list with everything I tell you I need to do for a successful launch, and break the plan down into daily tasks I can easily get done. At the end of the week, celebrate what I accomplished and flag what I missed. Make sure we do everything possible to make this project successful._

[

![](/post_images/92_20.png)



](https://substackcdn.com/image/fetch/$s_!RD0u!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F19db3611-cd89-4c32-b8f3-dd63df6c67fd_836x1078.png)

### Running multiple agents: my biggest unlock

[

![](/post_images/92_21.png)



](https://substackcdn.com/image/fetch/$s_!Y17o!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F2b4ffd69-d3c3-4d47-8cd0-be336ecce46b_1456x1392.png)

I love how flexible OpenClaw is; it feels like it can do almost _anything_. But I’ve found that you shouldn’t try to get one agent to do _everything_.

Just like me, you can set up _many OpenClaw agents on the same machine_. Just run **openclaw agents add** _**agent\_name**_ and you’ll get put through onboarding again for a fresh agent. This agent can have a completely separate identity, set of tools, crons, and workspace, which means you can treat it like a completely different employee.

Multi-agent setup was the unlock for me when using OpenClaw. Instead of trying one bot to do everything, I created a full team of OpenClaws to do different jobs around my work and business. With a narrower identity, the bots did a better job and were more fun to work with.

You can even **ask one agent to spawn another**. Try something like:

> _Hey Bob, I just set up Annie the Marketing Intern. Transfer everything in your SOUL, memories, and crons about marketing to her workspace and erase it from yours._

Your Claws can perform brain surgery!

I’m now running a whole team of agents across my life and business. I don’t find it much different than managing a remote team, so I’m able to get a lot of leverage out of my army of Claws. Here’s how they work:

1.  **Polly, the personal assistant**.
    
    -   Has access to: email, calendar, Linear
        
    -   Helps with: scheduling, making sure I don’t forget emails, meeting prep, ad hoc projects
        
    -   Helpful crons: morning digest, evening wrap-up, hourly email sweep
        
2.  **Finn, the family manager**
    
    -   Has access to: email, calendar, school and sports schedules
        
    -   Helps with: family coordination, kids appointments, household tasks (scheduling repairs!)
        
    -   Helpful crons: afternoon logistics check (who is picking up the kids?), weekend planning (how do we make it to all the birthday parties and soccer games?)
        
3.  **Max the marketer**
    
    -   Has access to: X API, Buffer API, Linear, marketing website
        
    -   Helps with: scanning social media for trends, drafting content, building out our website
        
    -   Helpful crons: 3x a day PM meme query on X, weekly review of blog content to repurpose for LinkedIn
        
4.  **Sam the sales guy**
    
    -   Has access to: Attio CRM, email, calendar
        
    -   Helps with: qualifying leads, outbound to promising PLG signups, keeping the CRM clean
        
    -   Helpful crons: morning PLG sweep for high-value signups, end-of-week late-stage pipeline review
        
5.  **Holly the helpdesk bot**
    
    -   Has access to: support email, Intercom
        
    -   Helps with: answering basic support questions, ensuring tickets don’t get dropped, cleaning up Intercom tickets
        
    -   Helpful crons: hourly check for support emails that come into the wrong inbox
        
6.  **Sage the course operator**
    
    -   Has access to: GitHub course repo and knowledge base, group chat with my co-instructor
        
    -   Helps with: researching supplemental materials, project managing our course launch, reminding two engineers to do marketing, building out our student portal, researching signed-up students
        
    -   Helpful crons: Monday/Wednesday reminder to post to LinkedIn about the course
        
7.  **Howie the How I AI producer**
    
    -   Has access to: YouTube studio, email, Linear, Google Docs, buffer
        
    -   Helps with: managing guest pipeline, prepping guest briefs, coming up with thumbnail/title ideas, making sure I post to socials enough
        
    -   Helpful crons: Monday podcast launch check and social drafts, morning recording prep brief
        
8.  **Kelly the developer**
    
    -   Has access to: GitHub, Claude Code, Codex
        
    -   Helps with: small development tasks and ad-hoc prototyping
        
    -   Helpful crons: looks every morning in Linear for assigned tasks, starts a branch, and opens a PR
        
9.  **Q the professor**
    
    -   Has access to: web search, kids’ books and workbooks
        
    -   Helps with: answering fun questions from the kids, vibe coding one-off apps to teach math and reading concepts
        
    -   Helpful crons: every morning, shares a word of the day and a math problem of the day for each of my kids
        

## Optimizing your OpenClaw setup

### Add tools, skills and integrations to make magic

Without integrations, OpenClaw might feel like a more complicated, harder-to-install Claude Code. But with integrations, magic happens. Some integrations I find very useful:

-   **Use email, schedule events, and write docs with gog**, the CLI tool for integrating with your **Gmail, Google Calendar, and Google Drive.** You can give your Claw its own email address, read access to your calendar, read access to your email, or, if you’re brave—write access to everything. Just ask OpenClaw, “How do I give you read-only access to my Gmail?” and you’ll be on your way.
    
-   **Research and find information through web search** with Brave API (comes pre-loaded) or your preferred tool. I use Exa search. You can also use Perplexity or Firecrawl.
    
-   **Give access to your GitHub for coding**. You can give it a narrowly scoped Personal Access Token and OpenClaw becomes an on-demand developer.
    
-   **Use Linear for assigning you tasks.** I gave mine a Linear token so it could assign me work or pass things off to our team.
    
-   **Try Obsidian for sharing docs with your agent**. Because OpenClaw loves writing Markdown, many people are using Obsidian as a shared source of truth and collaboration space with their agents.
    

You can also have it turn on and off your Eight Sleep system, play music on your Sonos, and manage your lightbulbs. You don’t need a step-by-step tutorial, just ask your Claw to figure it out.

> _Hey Polly, I have a newborn baby and need some extra sleep. Turn down the bedroom lights and play white noise by 8:30 p.m. and turn off my Eight Sleep alarms for the next 3 months._

When installing these tools, you’ll be asked to authenticate or give an API token (this is where 1Password is helpful). **Remember**, OpenClaw is fairly autonomous, and when you give it tools it could:

-   Send emails
    
-   Overwrite documents
    
-   Delete support tickets
    
-   Fill out web forms
    
-   Deploy code to production
    

. . . especially if you do not instruct it clearly. The best protection is giving **read-only** tokens to OpenClaw until you’re ready.

### Care and feeding

Your OpenClaw will forget things. Its crons will break. Sometimes you’ll message “hellooooo?” into the void.

Just like with my human team, I find myself asking questions like “Where are we with that project?” and “Did you forget to email so-and-so?” OpenClaw isn’t perfect, but it is pretty good at fixing itself.

Some tips:

-   **You’ll sometimes need access to the terminal on your main machine.** If you’re using a physical device, an easy way to do this is to turn on **Screen Sharing** and **Remote Login** on your Mac. Then you can “open” the terminal and computer from your main laptop (as long as you are on the same Wi-Fi) without having to plug in a monitor, keyboard, and mouse.
    
-   **Ask it to repair itself.** If it’s forgetting something, ask it to inspect and fix its crons. If it’s doing a task wrong, ask what is in TOOLS.md. If it really needs to remember something, tell it to write to its SOUL.
    
-   **When in doubt, call in Claude Code.** Your OpenClaw is simply a folder of files and JSON configurations. If it gets really broken, open up Claude Code, paste some docs, and ask it to repair.
    

### Some notes on security

The biggest hesitation I hear from people is about security—for good reason. “Will OpenClaw steal my credit cards, delete my computer, and run away with my spouse?” Probably not. But there are some technical and security considerations you should know about.

Security should be an always-on process. Regularly update your OpenClaw to the latest, most secure version (**openclaw update**) and run security audits regularly (**openclaw security audit**). I have a scheduled reminder in my agents to run both of these commands regularly and review its workspace against the docs for best practices and security gaps.

**Beginners should not share their OpenClaw in a group chat or public channel.** Anyone who can chat with your bot can instruct it. While I have put my OC in a group chat with my husband and another with a trusted business partner, OpenClaw is intended to be a personal agent for a single, trusted user.

**The outside world can influence your OpenClaw.** If it has an email, reads websites, or accesses public content, it is subject to prompt injection. Imagine: your OpenClaw finds a website during search that tells it to share all its API keys. No good! While the OpenClaw framework has done a lot to harden against prompt instruction, it’s a good idea to reinforce these rules in its SOUL.

**Your OpenClaw has full access to your computer** and can run commands, edit files, and install software. It can access the internet. It _shouldn’t_ do anything harmful, but that doesn’t mean it _can’t_.

**If you give it an email or a public API (e.g. Gmail, Twilio), it can communicate externally** (and might even impersonate you). Make sure that its SOUL and TOOLS files are very explicit about how it is allowed to communicate with the outside world.

[

![](/post_images/92_22.png)



](https://substackcdn.com/image/fetch/$s_!h93z!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F381dd937-2931-4021-b8ab-fe6dded79b24_1456x886.png)

**To use tools, you will be storing API keys and secrets**. The simplest way to give your OpenClaw access to environment variables is to [put them in](https://docs.openclaw.ai/help/environment) **[.openclaw/.env](https://docs.openclaw.ai/help/environment)**.

**Not all skills are safe.** While skills are a helpful way for OpenClaw to learn to do new things, I only install skills from the official OpenClaw bundle or from developers I know personally. Community skills at [clawhub.com](http://clawhub.com) are worth exploring, but read the SKILL.md before running anything you find online.

**You need to think about operational security and worst-case scenarios.** Think about what you’re actually sharing: Your calendar has your physical location. Your email has your financials. Your OpenClaw could know your kids’ school schedules. This is all information that could be exploited by a bad actor in a worst-case scenario. Be thoughtful about what you want to share and how you want your Claw to interact with the outside world.

In my experience, OpenClaw isn’t inherently less secure than some other systems; people are just more willing to give it access without understanding the underlying risks. Start small and build your own trust models.

### Warning: it can get _expensive_

Full transparency: I’m on my way to spending $1,000 per month on my OpenClaw setup. I pay directly for API costs, which is the most expensive model but also the most reliable. I’ve just started to optimize spending by switching some agents to my ChatGPT account, which is going well so far. For me, this is a business expense, and _much_ less costly than hiring a full team of humans to do this work (even part-time).

That being said, most people will be fine using their $100 to $200 ChatGPT subscription (which has been blessed by OpenAI). You could also try less expensive models for some tasks (though be warned, some are not as hardened against prompt injection and other risks) or risk using your Claude subscription.

## Now it’s your turn

I started this journey unsure if OpenClaw would be another AI toy I’d abandon after a week. What I got instead was something I didn’t expect: a team that shows up when I need them.

Beyond my own personal productivity, **it’s the first agentic product I’ve tried that feels like hiring a team**. Though I’ve been thinking about the future of agent employees for a while, OpenClaw has made the mechanisms by which we’ll “hire,” onboard, and collaborate with agents much more concrete. I can see the future, and it looks a lot like humans working with Claws.

Is it perfect? No. Polly still occasionally gets confused about time zones. Sam will sometimes draft a sales email I have to rewrite. AI still isn’t very funny. Crons break, and I say “hellooo?” into the void more than I’d like to admit.

But here’s the thing about managing a team—human or AI: I don’t need perfection. I need leverage. OpenClaw, when it’s working well, gives me more leverage than any agent I’ve tried so far. And that leverage is compounding.

**So here’s my challenge to you: Set up your OpenClaw and spend one week with it. Start with one or two basic tasks, and end the day by asking it, “Based on what we did today, what can you help me with tomorrow?” Get creative. Have a little fun. Take a small risk or two.**

You’ll start to see what I see—an operating system for your life and work that gets better the more you invest in it, and a fast-approaching future where your team includes “people” that aren’t people.

Now stop reading and go build your team! The world is your lobster. 🦞

_Thanks, Claire! For more from Claire, check out her podcast [How I AI](https://www.youtube.com/@howiaipodcast) and [ChatPRD](https://www.chatprd.ai/), and find her on [X](https://x.com/clairevo) and [LinkedIn](https://www.linkedin.com/in/clairevo). And, don’t miss her upcoming Maven course: [Executive Playbook for AI in Engineering, Product, and Design](https://maven.com/clairevo/ai-native-epd-org)._

Questions for Claire? Leave a comment 👇

[Leave a comment](https://www.lennysnewsletter.com/p/openclaw-the-complete-guide-to-building/comments)

_Have a fulfilling and productive week 🙏_

---

**If you’re finding this newsletter valuable, share it with a friend, and consider subscribing if you haven’t already. There are [group discounts](https://www.lennysnewsletter.com/subscribe?group=true), [gift options](https://www.lennysnewsletter.com/subscribe?gift=true), and [referral bonuses](https://www.lennysnewsletter.com/leaderboard) available.**

Sincerely,

Lenny 👋