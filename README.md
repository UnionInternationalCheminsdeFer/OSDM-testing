# OSDM Testing – OTSTS User Guide (Bruno)

## License and Copyright  
This repository is maintained by **UIC (Union Internationale des Chemins de fer)** and is licensed under the **Apache License, Version 2.0**.  

- The full license text can be found at: [Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0)  
- Unless required by applicable law or agreed upon in writing, this software is provided **"as-is"**, without warranties or conditions of any kind.  

### Usage Restrictions  
- No reproduction or distribution is allowed without the following notice:  
  > "This material is copyrighted by UIC, Union Internationale des Chemins de fer © 2023 – 2024. OSDM is a trademark belonging to UIC, and any use of this trademark is strictly prohibited unless otherwise agreed by UIC."  

For further inquiries, please contact UIC.

---

## General Information  
This repository contains API test collections for the **OTSTS (OSDM Testing Suite)**. It is designed to validate **OSDM API implementations** across different testing scenarios using **Bruno** as the test runner.

This guide explains how to install, configure, and run the OTSTS Bruno collections. It is structured to clearly separate:
- **Technical setup** (environment file)
- **Business scenario definition** (data file)
- **Execution modes** (manual, Bruno CLI)

---

## Repository Structure  
The repository includes the following files and folders:  

| Path | Description |
|------|------|
| `.gitignore` | Specifies files to be ignored by Git |
| `.vscode` | Configuration files for Visual Studio Code |
| `404.html` | Custom 404 error page |
| `assets/` | Contains images and other static assets |
| `CNAME` | Custom domain configuration for GitHub Pages |
| `collections/` | Postman collection for OTSTS scenarios |
| `collections-bruno/` | Bruno collection for OTSTS scenarios |
| `data_base/` | Data files containing test scenarios and business rules |
| `environment/` | Postman environment files for OTSTS scenarios |
| `Gemfile` & `Gemfile.lock` | Dependencies for the project |
| `images/` | Additional image assets |
| `index.md` | Main index file |
| `json_validator/` | JSON schema validation files – **do not modify** |
| `library/` | JavaScript libraries used in Postman requests – **do not modify** |
| `library-bruno/` | JavaScript libraries used in Bruno requests – **do not modify** |
| `LICENSE.txt` | License information |
| `README.md` | Project documentation |
| `SFR/` | Scenario Requirements |
| `SSD/` | Scenario Solution Description |
| `web/` | Web-related files |
| `_config.yml` | Configuration file |
| `_data/` | Data storage for the project |

---

## 1. Accessing OTSTS Resources

### 1.1 GitHub Repository

OTSTS resources are available from the official OTSTS GitHub repository.

**Recommended branch**
- Use the `exchange-dev` branch  
- This branch is more up to date than `master` and is actively used by the OTSTS team

Clone the repository:
```sh
git clone -b exchange-dev https://github.com/YOUR_ORG/OSDM-Testing.git
cd OSDM-Testing
```

---

### 1.2 Files to Use Locally

You need two types of files to get started.

#### Mandatory files

1. **Bruno Collection**  
   Located in: `collections-bruno/`  
   Contains the executable OTSTS test logic as `.yml` request files.

2. **Data file**  
   Located in: `data_base/`  
   Contains test scenarios and business rules.  
   This file **must be adapted** to your use cases.

#### Files you must NOT modify

The following resources must always be reused as-is from the repository:
- `library-bruno/` – JavaScript libraries used by Bruno requests
- `json_validator/` – JSON schema validation files

---

## 2. Opening the Collection in Bruno

1. Open **Bruno**
2. Click **Open Collection** and select the folder:  
   `collections-bruno/OTST_V1.4.9.1_RFND_EXCH_ALL/`
3. Select the appropriate environment from the `environments/` subfolder inside the collection
4. Ensure all environment variables are properly set before executing the test cases

---

## 3. Environment File – Technical & Runtime Configuration

### 3.1 What Is the Environment File?

The environment file defines **how Bruno connects to your OSDM API**.

> **Environment file = "How do I talk to my API?"**

It contains:
- Authentication configuration
- API base URL
- Scenario selection
- References to OTSTS resources (library, schema, data file)

It does **not** contain business rules.

---

### 3.2 Parameters to Configure

#### 3.2.1 Authentication

Two approaches are supported.

##### Option A – Token-only (recommended)

Use this if you generate the access token outside Bruno.

Set:
- `access_token`

Leave other authentication fields empty.

##### Option B – Token generation in Bruno

Use this if you want Bruno to generate tokens automatically via the **Access Token** folder.

Set:
- `client_id`
- `client_secret` or `user_id` / `password`
- Token endpoint parameters

Run the appropriate request from the `Access Token/` folder before executing the main flow.

---

#### 3.2.2 API URL

Set:
- `api_url` – Must point to your OSDM sandbox or test environment

---

#### 3.2.3 OSDM Version

Set:
- `osdm_version` (e.g. `3.7`, `3.8`)

Used for validation and compatibility checks.

---

#### 3.2.4 Scenario Selection

Set:
- `scenario_code` – Selects which scenario from the data file is executed

Example:
```
scenario_code = OTST_RFND_SRCH_CRIT_1ADT_1LEG
```

---

#### 3.2.5 Resource References

Normally unchanged:
- Library path (points to `library-bruno/`)
- JSON schema path (points to `json_validator/`)

Optional:
- Data file path – if using a local copy instead of the repository version

---

### 3.3 Environment File Summary

| Parameter | Must be changed |
|------|------|
| API URL | ✅ |
| Authentication | ✅ |
| Access token | ✅ |
| Scenario code | ✅ |
| OSDM version | ✅ |
| Library path | ❌ (normally unchanged) |
| JSON schema path | ❌ (normally unchanged) |
| Business rules | ❌ (belongs in data file) |

---

## 4. Data File – Business Scenarios & Test Logic

### 4.1 What Is the Data File?

The data file defines **what is tested**.

> **Data file = "What business scenario do I want to validate?"**

It contains:
- Scenarios
- Business rules
- Trip definitions
- Passenger and purchaser data

Located in: `data_base/`

---

### 4.2 Scenarios

Each scenario represents a complete business flow:
- Booking
- Fulfilment
- Refund
- Exchange

Each scenario has:
- A unique `scenario_code`
- A defined business intent

The environment variable `scenario_code` selects which scenario to execute.

---

### 4.3 Business Rules per Scenario

Defined inside the scenario, for example:
- Desired flexibility (fully / semi / non-flexible)
- Normal vs exceptional refund
- Overrule codes (e.g. `payment_failure`)
- OSDM version compatibility

---

### 4.4 Offer Search Criteria

Offer search criteria define:
- Offer mode (`individual` or `collective`)
- Fulfilment option
- Currency
- Travel class
- Ancillaries and admissions

Criteria are referenced by ID and reused across scenarios.

---

### 4.5 Trip Requirements

Two supported models:
- **OND-based** – origin, destination, date/time
- **Trip-based** – origin, destination, train ID, operator code

---

### 4.6 Passenger and Purchaser Data

The data file defines:
- Passenger lists
- Purchaser lists
- Date of birth
- Gender
- Single or multiple passengers

Used during booking and fulfilment.

---

### 4.7 Data File Summary

| Element | Belongs in data file |
|------|------|
| Scenarios | ✅ |
| Business rules | ✅ |
| Refund / exchange logic | ✅ |
| Trip definitions | ✅ |
| Passenger data | ✅ |
| API URL | ❌ (belongs in environment file) |
| Tokens | ❌ (belongs in environment file) |

---

## 5. Running the OTSTS Collection

OTSTS collections can be executed in two ways.

---

### 5.1 Manual Execution (Recommended for First Use)

1. Open Bruno and select the environment
2. If needed, run the appropriate request from the `Access Token/` folder to generate a token
3. Execute requests step by step from the `Common Requests/` folder:
   - Offer search
   - Booking
   - Patch booking (optional)
   - Fulfilment
   - Refund or exchange
4. Inspect responses and test assertions

Best suited for debugging and understanding behavior.

---

### 5.2 Using the Bruno CLI

#### 5.2.1 Install the Bruno CLI

```bash
npm install -g @usebruno/cli
```

#### 5.2.2 Run the Collection

```bash
bru run collections-bruno/OTST_V1.4.9.1_RFND_EXCH_ALL \
  --env <environment-name> \
  --output reports/report.json \
  --format json
```

Replace `<environment-name>` with the name of the environment file inside the `environments/` subfolder (without extension).

#### 5.2.3 View Results

Results are printed in the terminal after the run. If an output file is specified, you can inspect it for detailed pass/fail information per request.