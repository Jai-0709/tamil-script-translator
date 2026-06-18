# Ancient Tamil Inscription Translator: Project Architecture & Plan

## Overview
This project is an image classification pipeline designed to translate ancient Tamil script images into modern Tamil script equivalents.
The dataset consists of 28 ancient Tamil character classes (0 to 27) which map directly to 27 modern Tamil character classes (0 to 26), with class 27 designated as an "unknown" or "other" category.

## Dataset Structure
- **`images_categorised/`**: Base training data consisting of 28 folders (classes 0-27) of ancient Tamil character images.
- **`augmented_images/`**: Pre-augmented training data (classes 0-27). No further augmentation is necessary in the pipeline.
- **`Modern characters/`**: Target domain images representing modern Tamil characters (classes 0-26).

## Directory Architecture
The project is structurally divided into four primary components:

### 1. `models/` (Model Development & Definition)
Contains neural network architectures, pre-trained weights, and configuration mappings.
- **`label_map.json`**: Maps the 28 numerical classes to their modern string equivalents (0-26) and class 27 to "unknown".
- **`architecture/`**: Scripts defining the CNN, ResNet, or Custom OCR classification models.
- **`weights/`**: Saved model checkpoints post-training.

### 2. `notebooks/` (Exploration & Prototyping)
Jupyter notebooks for experimentation, data visualization, and model evaluation.
- Model training prototypes and pipeline definitions.
- Evaluation metrics and confusion matrices comparing predictions.
- Exploratory Data Analysis (EDA) on the `TAMIL SCRIPT DATASET`.

### 3. `backend/` (API & Inference Server)
A backend API (e.g., FastAPI, Flask) that serves the trained model to client applications.
- Exposes endpoints like `/predict` which accept an uploaded ancient script image.
- Preprocesses the incoming image to exactly match the `images_categorised/` training dimensions and formats.
- Performs inference via the model and returns the corresponding modern character classification.

### 4. `frontend/` (User Interface)
A user-facing web interface (e.g., React, Vue) that enables end-users to interact with the translator.
- Allows users to upload photos of ancient inscriptions or historical artifacts.
- Communicates with the backend REST API.
- Displays the recognized modern Tamil script and visualizes the results.

## Next Phase Execution Plan
1. **Model Selection & Setup**: Implement the classification model in `models/` and construct the training loop in `notebooks/`.
2. **Train on Pre-augmented Data**: Feed the `images_categorised/` and `augmented_images/` into the model and map outputs against `label_map.json`.
3. **Backend Integration**: Wrap the best-performing model into an API application in the `backend/` directory.
4. **Frontend Development**: Construct the user interface in `frontend/` and connect it to the backend for end-to-end end-user translation.
