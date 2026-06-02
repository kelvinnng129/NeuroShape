

# NeuroShape

NeuroShape is a web application that transforms images into interactive neural network representations using AI. Users can upload an image, and the app identifies the subject, removes the background, analyzes the silhouette, and generates a mesh-like visualization in the browser.

## The Concept
When I was learning about machine learning, I realized that neural network diagrams look incredibly cool and have amazing artistic potential. I thought: What if I could upload an image of a dog, and it directly transforms into a neural network structure mimicking that shape? That idea is how NeuroShape was born turning technical structures into generative art.

<table>
  <tr>
    <td valign="middle">
     <img src="https://github.com/user-attachments/assets/46ab3053-6407-41a4-a904-57dd1a3f6334" width="350" alt="Neural Network Structure" /></td>
    </td>
    <td valign="top">
      <img src="https://github.com/user-attachments/assets/91ba72ee-367a-4e01-9555-4848ff57e514" width="550" alt="Deep Neural Network" />
      <br />
      <sub style="color: gray;">Image source: <a href="https://www.ibm.com/think/topics/neural-networks" target="_blank">IBM</a></sub>
    </td>
  </tr>
</table>


## Try Here 
https://github.com/user-attachments/assets/f0182a3c-9a25-4040-900c-e4f3ebd29e17

<img width="2940" height="1846" alt="image" src="https://github.com/user-attachments/assets/83a3b1f0-a4c3-4761-926c-0d4b9cd12e24" />



> `(https://neuroshape.kelvinnng129.workers.dev/)` 


## How It Works 

1. **Upload** — Drag and drop or select an image.
2. **Identify** — GPT-4o (**Need your own API key** ) vision or CLIP identifies the main subject. image-captioning model recognizes the main subject in the image.
3. **Isolate** — The background is removed using `rembg`, leaving a cleaner silhouette.
4. **Analyze** — The silhouette is sliced horizontally to extract width and position data at each layer.
5. **Render** — The extracted shape data is converted into an interactive representation in the browser.

## AI Models and Libraries

- [CLIP](https://github.com/openai/CLIP) — used for image captioning and subject recognition.
- [rembg](https://github.com/danielgatis/rembg) — used for removing image backgrounds.


## Cascade
NeuroShape uses a robust 3-tier fallback system to ensure reliable results, even if API credits are unavailable.

GPT-4o (OpenAI or Poe): The primary engine for high-fidelity subject identification and deep structural analysis.

CLIP : A powerful, cost-free fallback that provides reliable subject recognition without requiring external API keys.

Shape Geometry: The final "always-available" fallback that analyzes silhouette pixels to classify the object as a basic form.


## Tech Stack

### Frontend

- Next.js

- React
- TypeScript
- Three.js
- Tailwind CSS

### Backend

- FastAPI
- Python
- BLIP image captioning
- rembg background removal
- Pillow
- NumPy
- PyTorch / Transformers

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- npm

> Note: `rembg` requires Python `>=3.11` and `<3.14`.


