# OSDM Testing

## License and Copyright  
This repository is maintained by **UIC (Union Internationale des Chemins de fer)** and is licensed under the **Apache License, Version 2.0**.  

- The full license text can be found at: [Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0)  
- Unless required by applicable law or agreed upon in writing, this software is provided **"as-is"**, without warranties or conditions of any kind.  

### Usage Restrictions  
- No reproduction or distribution is allowed without the following notice:  
  > "This material is copyrighted by UIC, Union Internationale des Chemins de fer © 2023 – 2024. OSDM is a trademark belonging to UIC, and any use of this trademark is strictly prohibited unless otherwise agreed by UIC."  

For further inquiries, please contact UIC.

## General Information  
This repository contains Postman collection tests for the OTST (Open Sales and Distribution Model Testing). It is designed to validate different testing scenarios developed within Postman.  

## Repository Structure  
The repository includes the following files and folders:  

- **`.gitignore`** – Specifies files to be ignored by Git.  
- **`.vscode`** – Configuration files for Visual Studio Code.  
- **`404.html`** – Custom 404 error page.  
- **`assets/`** – Contains images and other static assets.  
- **`CNAME`** – Custom domain configuration for GitHub Pages.  
- **`collections/`** – Postman collection for OTST scenarios.  
- **`data_base/`** – Data files used for sandbox testing.  
- **`environment/`** – Postman environment collection for OTST scenarios.  
- **`Gemfile` & `Gemfile.lock`** – Dependencies for the project.  
- **`images/`** – Additional image assets.  
- **`index.md`** – Main index file.  
- **`json_validator/`** – JSON schema validator files.  
- **`library/`** – JavaScript libraries used in Postman requests.  
- **`LICENSE.txt`** – License information.  
- **`README.md`** – Project documentation.  
- **`SFR/`** – Scenario Requirements.  
- **`SSD/`** – Scenario Solution Description.  
- **`web/`** – Web-related files.  
- **`_config.yml`** – Configuration file.  
- **`_data/`** – Data storage for the project.  

## Installation and Prerequisites  

To set up the project locally, follow these steps:  

1. **Clone the repository**  
   Run the following command to clone the repository from the `master` branch:
    ```sh
    git clone -b master https://github.com/YOUR_ORG/OSDM-Testing.git
    cd OSDM-Testing
2. **Select the correct environment and set up environment variables**  
    1.1 Open Postman and import the appropriate environment file from the environment/ folder.

    1.2 Ensure that all necessary environment variables are properly set before executing the test cases.

## Run the Collection
1. **Prepare the test scenario**  
    1.1 Using the correct data file from the data_base/ folder, retrieve the scenario code you want to execute.

    1.2 Assign the retrieved scenario code to the corresponding environment variable in Postman.

    ```
    Env variable  : scenarioCode
    Example value : OTST_RFND_SRCH_CRIT_1ADT_1LEG
2. **Execute the test flow**  
    1.1 Run the required Postman requests following the intended test flow.