---
layout: page
title: Scenario Development Process
permalink: /development-process/
---

# Scenario Development Process

Scenarios used for testing and validation of OSDM APIs can be developed by the members of OTST, or third parties. The development process ensures every scenario to be agreed, specified, documented, and tested against live APIs.

The process is managed using [Github Issues](https://github.com/UnionInternationalCheminsdeFer/OSDM-testing/issues) and [Github Project](https://github.com/orgs/UnionInternationalCheminsdeFer/projects/11).

Everyone can suggest new scenario by creating an _Issue_ at Github. Every scenario suggestion must contain brief description of what should be tested, if there are particular requirements on `Trip` (single/multi-leg, mono/multi-modal, etc.), products (NRT, TLT, IRT, reservations, ancillaries, etc.), number of passengers or others.

Issue status:

* **Open**: Unsorted list of scenario suggestions or other tasks to reviewed
* **Specification**: Issues agreed by OTST to be developed. For scenarios, formal SFR Document is created at [Github Wiki](https://github.com/UnionInternationalCheminsdeFer/OSDM-testing/wiki) and `Scenario Type Prefix` is assigned.
* **Design**: Issues that have formal description of expected functionality or change. For scenarios, formal SSD Document is created at Github Wiki.
* **In progress**: Development of the changes or functionality described in the issues, SFR and SSD.
* **In review**: Code review of developed changes.
* **In testing**: Functional testing of developed changes.
* **Done**: Issue has been completed.

**SFR** - Scenario Functional Requirements

**SSD** - Scenarion Solution Description
