---
layout: post
title: "Video World Models"
author: Soran Ghaderi
date: 2026-01-20
image: https://self-forcing.github.io/examples/movie-gen-10s/A%20dynamic%20speedboat%20speeding%20across%20a%20tranquil%20lake,%20generating%20a%20massive%20wake%20that%20churns%20the%20water-0.mp4
featured: true
hidden: false
comments: true
categories: Video-Generation World-models
excerpt: "Video diffusion models can generate stunning short clips, but building true world simulators requires a fundamental shift. This post explores how recent advances in causal attention, distribution matching distillation, and long-range memory are enabling real-time video generation that can extend to minutes while maintaining temporal coherence."
---

## The World Simulator Problem

Video generation has reached a peculiar inflection point. State-of-the-art diffusion models can synthesize remarkably realistic short clips, but they fundamentally cannot serve as world simulators. Why? Because they generate all frames simultaneously using bidirectional attention. The future affects the past.

This bidirectional design creates a hard constraint. If you want to generate frame 50, you must also generate frame 100 at the same time. There is no mechanism to produce frames on the fly as new conditions arrive. You cannot build an interactive game engine, a robotic planning module, or a live streaming system on top of a model that requires clairvoyance.

The goal of this post is to trace the path from slow, bidirectional video diffusion to fast, autoregressive world models. Along the way, I will cover the core ideas that make this transition possible.

We begin with the causality problem and how masking attention can convert a bidirectional model to a causal one <cite data-key="causevid_2024"></cite>. We then examine the train-test distribution mismatch that plagues autoregressive generation through the lens of three training paradigms: Teacher Forcing, Diffusion Forcing <cite data-key="diffusion_forcing_2025"></cite>, and Self Forcing <cite data-key="self_forcing_2025"></cite>. We will see how MotionStream <cite data-key="motionstream_2025"></cite> extends these ideas to motion-controlled, infinite-length streaming through attention sinks. We will take a closer look at distribution matching distillation <cite data-key="dmd2_2024"></cite>, which compresses 50-step diffusion into 4 steps while preserving quality. We will look at Mixture of Contexts <cite data-key="moc_2025"></cite>, a learnable sparse attention mechanism that gives the model minute-long memory without the quadratic cost. And we will touch on the emerging class of 4D world models <cite data-key="tesseract_2025, aether_2025"></cite> that jointly predict geometry, appearance, and dynamics.

Throughout, I will try to connect these developments. The recurring theme is that video generation is fundamentally about *compressing the past into a representation that predicts the future*, and different architectural choices make different tradeoffs in this compression.

## Causality in Video Diffusion

Standard video diffusion transformers process all frames together with bidirectional self-attention. Every token attends to every other token across space and time. This global receptive field is powerful for capturing coherence but has a fatal flaw for interactive applications. Generating a single frame requires the model to process all frames, including those from the future.

Diffusion models learn to reverse a forward noising process. Given a clean image $x_0$, the forward process adds Gaussian noise according to a schedule:

<div class="academic-equation" id="eq-forward">

$$x_t = \alpha_t x_0 + \sigma_t \epsilon, \quad \epsilon \sim \mathcal{N}(0, I)$$

</div>

where $\alpha_t, \sigma_t > 0$ define the signal-to-noise ratio at timestep $t \in [0, T]$. The model is trained to predict the noise $\epsilon$ from the noisy sample:

<div class="academic-equation" id="eq-denoising-loss">

$$\mathcal{L}(\theta) = \mathbb{E}_{t, x_0, \epsilon} \left\| \epsilon_\theta(x_t, t) - \epsilon \right\|_2^2$$

</div>

The predicted noise relates to the **score function** (gradient of log probability) through:

<div class="academic-equation" id="eq-score">

$$s_\theta(x_t, t) = \nabla_{x_t} \log p(x_t) = -\frac{\epsilon_\theta(x_t, t)}{\sigma_t}$$

</div>

This score function is independent of the intractable partition function, which is what makes score-based sampling possible.

The simplest fix for causality is to mask the attention. A causal mask prevents tokens in frame $t$ from attending to tokens in frames $t' > t$. CausVid <cite data-key="causevid_2024"></cite> implements this with a block-wise causal attention mask:

<div class="academic-equation" id="eq-causal-mask">

$$M_{i,j} = \begin{cases} 1, & \text{if } \lfloor j/k \rfloor \leq \lfloor i/k \rfloor \\ 0, & \text{otherwise} \end{cases}$$

</div>

where $i, j$ index frames and $k$ is the chunk size (number of latent frames processed together). This converts the model from a joint denoiser into a conditional one that can generate frames sequentially.

<figure class="academic-figure" id="fig-causal-attention" style="text-align: center; margin: 2rem auto; display: block;">
<img src="https://arxiv.org/html/2412.07772v4/x5.png" alt="Causal attention mask for video diffusion" style="max-width: 75%; display: block; margin: 0 auto;">
<figcaption data-caption="A causal diffusion transformer architecture. Tokens in the current frame only attend to tokens from current and previous frames. This enables sequential generation with KV caching."></figcaption>
</figure>

But switching the attention mask is not free. A model trained with bidirectional attention has learned to exploit information from the future when denoising the present. Simply applying a causal mask at inference breaks this expectation. The model's predictions degrade because it no longer has access to information it was trained to use.

The solution from CausVid <cite data-key="causevid_2024"></cite> is elegant. Rather than naively fine-tuning a causal student on causal data, we use **asymmetric distillation**. The student has causal attention. The teacher retains bidirectional attention. The student learns to match the output distribution of the bidirectional teacher, not the behavior of a weaker causal teacher.

This asymmetric setup has a critical advantage. The bidirectional teacher does not suffer from error accumulation because it sees all frames simultaneously. When the causal student is trained to match this teacher's distribution, it inherits this robustness, even though it will later generate frames sequentially. The teacher never makes the kinds of mistakes the student would make if it were trained on its own outputs.

The asymmetric distillation uses distribution matching loss (specifically DMD <cite data-key="dmd2_2024"></cite>) to align the student's output distribution with the teacher's. The key idea is that the gradient of the reverse KL divergence $D_{\text{KL}}(p_{\text{gen},t} \parallel p_{\text{data},t})$ at each noise level $t$ can be expressed as a difference of score functions:

<div class="academic-equation" id="eq-dmd">

$$\nabla_\phi \mathcal{L}_{\text{DMD}} = -\mathbb{E}_{t, \hat{x}_t, \hat{x} \sim p_\theta} \left[ \left( s_{\text{data}}(\hat{x}_t, t) - s_{\text{gen},\xi}(\hat{x}_t, t) \right) \frac{\partial \hat{x}}{\partial \phi} \right]$$

</div>

where $G\_\phi$ is the student generator, $\hat{x} = G\_\phi(\epsilon)$ is the generated sample, $\hat{x}\_t = \Psi(\hat{x}, t)$ is the noised version via the forward process from <a href="#eq-forward" class="eqref"></a>, $s\_{\text{data}}$ is approximated by a pretrained bidirectional teacher, and $s\_{\text{gen},\xi}$ is learned online using samples from the generator. This is equivalent to the following loss function:

<div class="academic-equation" id="eq-dmd-loss">

$$\mathcal{L}_{\text{DMD}}(\phi) = \mathbb{E}_{t, \hat{x}_t, \hat{x}} \left[ \frac{1}{2} \left\| \hat{x} - \text{sg}\left[ \hat{x} - (f_\psi(\hat{x}_t, t) - f_\phi(\hat{x}_t, t)) \right] \right\|^2 \right]$$

</div>

where $\text{sg}[\cdot]$ denotes stop-gradient. The formulation allows the teacher and student to have entirely different attention patterns, which is critical for asymmetric (bidirectional→causal) distillation.

Once the causal student is trained, it can leverage **KV caching** for efficient inference. When generating frame $t+1$, all the key-value pairs from frames $1$ through $t$ are already computed and stored. Only the new frame's queries need to attend to the cached keys and values. This reduces the time complexity from $O(N^2)$ (where $N$ is the sequence length) to $O(N)$ per new frame.

<figure class="academic-figure" id="fig-causevid-method" style="text-align: center; margin: 2rem auto; display: block;">
<img src="https://causvid.github.io/images/methods.jpg" alt="CausVid method overview" style="max-width: 95%; display: block; margin: 0 auto; border-radius: 8px;">
<figcaption data-caption="CausVid method overview. The approach distills a many-step bidirectional video diffusion model into a 4-step causal generator through two stages: (1) Student Initialization using ODE solution pairs from the teacher, and (2) Asymmetric Distillation using distribution matching loss with a bidirectional teacher supervising a causal student."></figcaption>
</figure>

<figure class="academic-figure" id="fig-causevid-demo" style="text-align: center; margin: 2rem auto; display: block;">
<video autoplay loop muted playsinline style="max-width: 95%; display: block; margin: 0 auto; border-radius: 8px;">
  <source src="https://huggingface.co/datasets/tianweiy/causvid_website/resolve/main/videos/5s_t2v_decoded/video_0005.mp4" type="video/mp4">
</video>
<figcaption data-caption="CausVid text-to-video generation example. The model generates high-quality videos from text with an initial latency of just 1.3 seconds, after which frames stream continuously at 9.4 FPS on a single GPU."></figcaption>
</figure>

The result is dramatic. CausVid achieves 9.4 FPS on a single GPU with a first-frame latency of only 1.3 seconds, compared to 219 seconds for the bidirectional teacher to generate a 128-frame video. The causal model generates frames faster than video playback rate.

## The Exposure Bias Problem

Converting a bidirectional model to causal is only half the battle. Autoregressive models face a fundamental challenge called **exposure bias** (also known as the train-test gap).

During training, the model predicts the next frame conditioned on *ground-truth* previous frames from the dataset. During inference, the model predicts the next frame conditioned on *its own previous outputs*. These are not the same distribution. The model has never seen its own mistakes during training, so it does not know how to recover from them.

Errors compound over time. A small artifact in frame 10 provides a corrupted input for generating frame 11. The corruption grows. By frame 50, the video may be unrecognizable. This is why early autoregressive video models produced quality that degraded rapidly with sequence length.

<figure class="academic-figure" id="fig-exposure-bias" style="text-align: center; margin: 2rem auto; display: block;">
<img src="https://moonlight-paper-snapshot.s3.ap-northeast-2.amazonaws.com/arxiv/self-forcing-bridging-the-train-test-gap-in-autoregressive-video-diffusion-1.png" alt="Training paradigms for autoregressive video diffusion" style="max-width: 95%; display: block; margin: 0 auto;">
<figcaption data-caption="Three training paradigms for autoregressive video diffusion. (a) Teacher Forcing conditions on clean ground-truth frames. (b) Diffusion Forcing conditions on noisy versions of ground-truth frames. (c) Self Forcing conditions on the model's own generated outputs, matching the inference-time distribution."></figcaption>
</figure>

Three training strategies have been developed to address exposure bias, each with different tradeoffs.

### Teacher Forcing

**Teacher Forcing** <cite data-key="WilliamsZipser1989"></cite> is the simplest approach where they train the model to denoise each frame conditioned on clean ground-truth previous frames. This is efficient and parallelizable (with appropriate masking), but the training distribution is far from the inference distribution. The model learns to generate the next frame assuming perfect context, which never happens during autoregressive inference.

### Diffusion Forcing

**Diffusion Forcing** <cite data-key="diffusion_forcing_2025"></cite> introduces a conceptually interesting idea; instead of treating noise level as a global property of the sequence, each token has an independent noise level. This treats noise as a continuous masking mechanism.

The key insight is that standard diffusion and next-token prediction are two extremes of the same spectrum. In full-sequence diffusion, all frames share the same noise level $k$. In next-token prediction, context frames are clean ($k = 0$) and the predicted frame is pure noise ($k = K$). Diffusion Forcing interpolates between these extremes.

The paper uses an RNN-based architecture where latent states $\mathbf{z}\_t$ capture sequential dependencies. At each timestep $t$, the model receives the previous latent state $\mathbf{z}\_{t-1}$ and a noisy observation $\mathbf{x}\_t^{k\_t}$ at noise level $k\_t$. During training, each timestep's noise level $k\_t$ is sampled independently and uniformly from $\{0, 1, \ldots, K\}$. The training objective minimizes the noise prediction error:

<div class="academic-equation" id="eq-df-loss">

$$\mathcal{L}_{\text{DF}}(\theta) = \mathbb{E}_{t, \mathbf{x}_t, \epsilon_t, z_t \sim {p_\theta (z | z_{t-1},x_{t}^{k_t}, k_t)}} \left[ \sum_{t=1}^T \left\| \epsilon_t - \epsilon_\theta(\mathbf{z}_{t{-}1}, \mathbf{x}_t^{k_t}, k_t) \right\|^2 \right]$$

</div>

where $k\_{1{:}T} \sim \text{Uniform}([K]^T)$ and $\mathbf{z}\_t$ is computed recurrently from previous states.

<figure class="academic-figure" id="fig-diffusion-forcing" style="text-align: center; margin: 2rem auto; display: block;">
<img src="https://www.boyuan.space/diffusion-forcing/static/images/method.png" alt="Diffusion Forcing method" style="max-width: 90%; display: block; margin: 0 auto;">
<figcaption data-caption="Diffusion Forcing allows each token to have a different noise level. This unifies full-sequence diffusion (all tokens share noise level) and next-token prediction (context is clean, prediction is noisy)."></figcaption>
</figure>

The insight is that **noise acts as a continuous mask**. Discrete masking (as in BERT or MAE) either reveals or hides a token. Noise provides soft, continuous masking where the token is partially revealed, with the degree of revelation controlled by the noise level. At $k = 0$, we have the clean token. As $k \to K$, the observation approaches pure Gaussian noise, conveying no information about the original.

Diffusion Forcing was shown to generate 2000+ frame videos (trained on only 36 frames) without sliding window inference and without quality collapse. However, it still does not fully match the inference distribution and the noisy context frames during training are *noisy versions of ground truth*, not *noisy versions of model outputs*. The model still never sees its own generation artifacts.

<figure class="academic-figure" id="fig-df-demo" style="text-align: center; margin: 2rem auto; display: block;">
<video autoplay loop muted playsinline style="max-width: 95%; display: block; margin: 0 auto; border-radius: 8px;">
  <source src="https://www.boyuan.space/diffusion-forcing/static/videos/video_prediction/minecraft.mp4" type="video/mp4">
</video>
<figcaption data-caption="Diffusion Forcing video prediction on Minecraft. The model generates stable, consistent rollouts far beyond its training horizon."></figcaption>
</figure>

### Self Forcing

The key insight of Self Forcing <cite data-key="self_forcing_2025"></cite> is very simple. Instead of conditioning on ground-truth frames during training, condition on the model's own generated frames. Perform the full autoregressive rollout during training, using KV caching, exactly as you would at inference time.

Formally, autoregressive video diffusion factorizes the joint distribution using the chain rule:

<div class="academic-equation" id="eq-ar-factorization">

$$p(x_{1:N}) = \prod_{i=1}^{N} p(x_i \mid x_{<i})$$

</div>

where each conditional $p(x_i \mid x_{<i})$ is modeled as a diffusion process. The forward process corrupts each frame independently:

<div class="academic-equation" id="eq-per-frame-forward">

$$x_{t_i}^i = \Psi(x_i, \epsilon_i, t_i) = \alpha_{t_i} x_i + \sigma_{t_i} \epsilon_i$$

</div>

where $t_i \in [0, 1000]$ can be sampled independently for each frame $i$.

<figure class="academic-figure" id="fig-self-forcing-attention" style="text-align: center; margin: 2rem auto; display: block;">
<img src="https://arxiv.org/html/2506.08009v2/x2.png" alt="Attention masks for different training paradigms" style="max-width: 95%; display: block; margin: 0 auto;">
<figcaption data-caption="Attention mask configurations for Teacher Forcing (a), Diffusion Forcing (b), and Self Forcing (c). Self Forcing uses KV caching during training, mirroring the inference process exactly."></figcaption>
</figure>

This is computationally expensive if done naively. A 50-step diffusion model generating 100 frames would require 5000 forward passes, with gradients through all of them. The memory and compute requirements would be prohibitive.

Self Forcing addresses this through three design choices.

First, it uses a **few-step diffusion model** (4 steps instead of 50). The model distribution is implicitly defined as a composition of denoising steps:

<div class="academic-equation" id="eq-few-step">

$$p_\theta(x_i | x_{<i}) = f_{\theta, t_1} \circ f_{\theta, t_2} \circ \cdots \circ f_{\theta, t_T}(x_{t_T}^i)$$

</div>

where $f_{\theta, t_j}(x_{t_j}^i) = \Psi(G_\theta(x_{t_j}^i, t_j, x_{<i}), t_{j-1})$ and $\{t_0 = 0, t_1, \ldots, t_T = 1000\}$ is a subsequence of timesteps (typically $T = 4$ with a uniform schedule at $[1000, 750, 500, 250]$).

Second, it uses **stochastic gradient truncation**. At each training iteration, a random denoising step $s$ is sampled uniformly from $\{1, 2, \ldots, T\}$. Only the gradients from the $s$-th denoising step are propagated. Earlier steps are treated as fixed. This ensures all denoising steps receive supervision without requiring backpropagation through the entire chain.

Third, it **detaches gradients** across frames. The KV embeddings from previous frames are treated as constants when computing gradients for the current frame. This prevents gradient explosion from very long autoregressive chains.

<figure class="academic-figure" id="fig-self-forcing-demo" style="text-align: center; margin: 2rem auto; display: block;">
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 1rem; max-width: 900px; margin: 0 auto;">
  <div style="text-align: center;">
    <video autoplay loop muted playsinline style="width: 100%; border-radius: 6px; aspect-ratio: 16/9; object-fit: cover;">
      <source src="https://self-forcing.github.io/static/videos/wan/0000.mp4" type="video/mp4">
    </video>
    <p style="margin: 0.4rem 0 0; font-size: 0.85em; font-weight: 500;">Wan2.1-1.3B</p>
  </div>
  <div style="text-align: center;">
    <video autoplay loop muted playsinline style="width: 100%; border-radius: 6px; aspect-ratio: 16/9; object-fit: cover;">
      <source src="https://self-forcing.github.io/static/videos/skyreels2/0000.mp4" type="video/mp4">
    </video>
    <p style="margin: 0.4rem 0 0; font-size: 0.85em; font-weight: 500;">SkyReels2-1.3B</p>
  </div>
  <div style="text-align: center;">
    <video autoplay loop muted playsinline style="width: 100%; border-radius: 6px; aspect-ratio: 16/9; object-fit: cover;">
      <source src="https://self-forcing.github.io/static/videos/causvid/0000.mp4" type="video/mp4">
    </video>
    <p style="margin: 0.4rem 0 0; font-size: 0.85em; font-weight: 500;">CausVid-1.3B</p>
  </div>
  <div style="text-align: center;">
    <video autoplay loop muted playsinline style="width: 100%; border-radius: 6px; aspect-ratio: 16/9; object-fit: cover;">
      <source src="https://self-forcing.github.io/static/videos/self_forcing_dmd/0000.mp4" type="video/mp4">
    </video>
    <p style="margin: 0.4rem 0 0; font-size: 0.85em; font-weight: 500;">Self Forcing-1.3B</p>
  </div>
</div>
<figcaption data-caption="Qualitative comparison across methods on the same prompt. Wan2.1 and SkyReels2 are slower bidirectional/AR models. CausVid is fast but exhibits progressive color saturation drift due to error accumulation. Self Forcing maintains consistent quality at real-time speeds."></figcaption>
</figure>

With these modifications, Self Forcing training is surprisingly efficient. The per-iteration training time is comparable to Teacher Forcing and Diffusion Forcing. But the quality improvements are significant.

The training objective aligns the distribution of *complete generated videos* with the distribution of *real videos*. This is a holistic, video-level objective, not a frame-level one. Several distribution matching losses work well with Self Forcing.

**DMD** minimizes the reverse KL divergence $\mathbb{E}\_t[D_{\text{KL}}(p_{\theta,t} \parallel p_{\text{data},t})]$ using the score difference gradient from <a href="#eq-dmd" class="eqref"></a>.

**SiD (Score Identity Distillation)** minimizes the Fisher divergence:

<div class="academic-equation" id="eq-sid">

$$
\begin{aligned}
\mathcal{L}_{\text{SiD}}(\theta) = \mathbb{E}_{t, \hat{x}_t, \hat{x}} \Big[ &(f_\phi(\hat{x}_t, t) - f_\psi(\hat{x}_t, t))^T (f_\psi(\hat{x}_t, t) - \hat{x}) \\
&+ (1-\alpha) \| f_\phi(\hat{x}_t, t) - f_\psi(\hat{x}_t, t) \|^2 \Big]
\end{aligned}
$$

</div>

where $f_\phi$ is the real score network and $f_\psi$ is the learned generator score. While $\alpha = 0.5$ theoretically corresponds to the Fisher divergence $\mathbb{E}\_{t, p_{\theta,t}}[\parallel \nabla \log p_{\theta,t} - \nabla \log p_{\text{data},t} \parallel^2]$, the authors found that $\alpha = 1$ yields more stable training in practice.

**GAN losses** use R3GAN, which combines relativistic pairing with R1+R2 regularization:

<div class="academic-equation" id="eq-gan">

$$\mathcal{L}_D(\psi) = -\mathbb{E}_{t, x_t, \hat{x}_t} \left[ \log \sigma(f_\psi(x_t) - f_\psi(\hat{x}_t)) \right] + \lambda \mathcal{L}_{\text{reg}}$$

</div>

where $x_t \sim p_{\text{data},t}$, $\hat{x}\_t \sim p\_{\theta,t}$, and the regularization encourages smooth discriminator outputs.

All three produce models with similar quality. The key is not which divergence you minimize, but that you minimize a divergence on the *inference-time distribution*, not the training-time distribution.

Self Forcing also introduces a **rolling KV cache** for long video generation. Bidirectional models require $O(TL^2)$ complexity since they cannot use KV caching. Prior causal models with KV recomputation have $O(L^2 + TL)$ complexity when the sliding window shifts. The rolling KV cache maintains a fixed-size buffer and discards the oldest entries as new frames are generated, achieving $O(TL)$ complexity for extrapolating videos beyond the training context length.

<figure class="academic-figure" id="fig-rolling-kv" style="text-align: center; margin: 2rem auto; display: block;">
<img src="https://arxiv.org/html/2506.08009v2/x3.png" alt="Efficiency comparisons for video extrapolation" style="max-width: 90%; display: block; margin: 0 auto;">
<figcaption data-caption="Efficiency comparisons for video extrapolation. (a) Bidirectional models cannot use KV caching. (b) Prior causal models recompute KV when shifting the window. (c) Rolling KV cache enables efficient extrapolation without recomputation."></figcaption>
</figure>

The result is a model that generates 17 FPS with 0.69 second latency (chunk-wise) or 8.9 FPS with 0.45 second latency (frame-wise) on a single H100 GPU. This is fast enough for real-time streaming applications.

## MotionStream: Interactive Control and Infinite Length

Self Forcing closes the train-test gap for autoregressive video diffusion, but two challenges remain for truly interactive world models. First, how do you condition generation on user inputs that arrive continuously during inference, such as camera movements or object drags? Second, how do you maintain quality when generating beyond the training horizon into arbitrarily long sequences?

**MotionStream** <cite data-key="motionstream_2025"></cite> addresses both. The goal is real-time, motion-controlled video generation that can run indefinitely with constant latency on a single GPU.

<figure class="academic-figure" id="fig-motionstream-teaser" style="text-align: center; margin: 2rem auto; display: block;">
<video autoplay loop muted playsinline style="max-width: 95%; display: block; margin: 0 auto; border-radius: 8px;">
  <source src="https://joonghyuk.com/motionstream-web/assets/streaming_demo/ocean-book_compressed.mp4" type="video/mp4">
</video>
<figcaption data-caption="MotionStream enables real-time interactive video generation with motion control. Users can drag objects, control cameras, or transfer motion from reference videos, with results streaming at up to 29 FPS on a single H100 GPU."></figcaption>
</figure>

The architecture starts with a motion-conditioned teacher model. Each 2D track is represented as a $d$-dimensional sinusoidal embedding $\phi_n$ derived from a unique ID, placed at spatially downsampled locations in the conditioning signal $c_m \in \mathbb{R}^{T \times H/s \times W/s \times d}$. A lightweight track head (just 4× temporal compression plus a 1×1×1 convolution) processes these embeddings before concatenation with video latents. This is far more efficient than ControlNet-style architectures that duplicate network blocks.

The teacher is trained with rectified flow matching on the velocity field $v_\theta(z_t, t, c_t, c_m)$, where $c_t$ is the text prompt and $c_m$ is the motion condition. A key design choice is **joint text-motion guidance**:

<div class="academic-equation" id="eq-joint-guidance">

$$\hat{v} = v_{\text{base}} + w_t \cdot (v(c_t, c_m) - v(\varnothing, c_m)) + w_m \cdot (v(c_t, c_m) - v(c_t, \varnothing))$$

</div>

where $v_{\text{base}} = \alpha \cdot v(\varnothing, c_m) + (1-\alpha) \cdot v(c_t, \varnothing)$ and $\alpha = w_t/(w_t + w_m)$. Text guidance provides natural dynamics (weather changes, secondary motions) while motion guidance enforces precise trajectory adherence. Pure motion guidance produces overly rigid 2D translations. Pure text guidance loses trajectory fidelity. Their combination (with $w_t = 3.0$, $w_m = 1.5$) balances both.

<figure class="academic-figure" id="fig-motionstream-pipeline" style="text-align: center; margin: 2rem auto; display: block;">
<img src="https://arxiv.org/html/2511.01266v2/x2.png" alt="MotionStream training pipeline" style="max-width: 95%; display: block; margin: 0 auto;">
<figcaption data-caption="MotionStream training pipeline. The bidirectional teacher (top) is trained with flow matching on motion-conditioned video. The causal student (bottom) is distilled via Self Forcing-style DMD with joint guidance baked into the objective, using attention sinks and rolling KV cache during both training and inference."></figcaption>
</figure>

The causal student is distilled using Self Forcing with DMD. But naively applying Self Forcing to motion-controlled generation reveals a problem where quality degrades rapidly when extrapolating beyond the teacher's training horizon (81 frames). Analyzing attention maps provides the explanation.

Many attention heads persistently focus on tokens from the initial frame throughout generation, even as the context window shifts. This mirrors the "attention sink" phenomenon observed in StreamingLLM <cite data-key="streamingllm_2023"></cite> for language models, where the first few tokens absorb disproportionate attention mass regardless of their semantic content. In video, the initial frame serves as an anchor that stabilizes generation.

MotionStream exploits this by maintaining $S$ **sink chunks** from the initial frame alongside a local window of $W$ recent chunks. The context for denoising chunk $i$ becomes:

<div class="academic-equation" id="eq-motionstream-context">

$$\mathcal{C}_i = \{z_t^i\} \cup \{z_0^j\}_{j \leq S} \cup \{z_0^j\}_{\max(1, i-W) \leq j < i}$$

</div>

where $z_t^i$ is the current noisy chunk and $z_0^j$ are previously generated clean chunks. The sink tokens use frozen RoPE positions (computed once at initialization), while window tokens receive dynamic positions based on their current cache location. This creates a temporal discontinuity between sink and window that the model learns to handle during training.

<figure class="academic-figure" id="fig-attention-sink" style="text-align: center; margin: 2rem auto; display: block;">
<img src="https://arxiv.org/html/2511.01266v2/x3.png" alt="Attention probability maps showing attention sink phenomenon" style="max-width: 90%; display: block; margin: 0 auto;">
<figcaption data-caption="Attention probability maps for bidirectional, full causal, and sliding window attention. Several heads focus persistently on initial frame tokens throughout generation. MotionStream leverages this by maintaining sink tokens as fixed anchors."></figcaption>
</figure>

Crucially, MotionStream trains with the same attention sink and rolling KV cache configuration used at inference. This **extrapolation-aware training** eliminates the train-test gap for long sequences. The teacher evaluates continuous video frames (no temporal discontinuity), providing robust score targets. The student learns to handle the sink-window discontinuity because it appears identically during training.

The DMD gradient for the causal student incorporates joint guidance directly:

<div class="academic-equation" id="eq-motionstream-dmd">

$$\nabla_\theta \mathcal{L}_{\text{DMD}} \approx -\mathbb{E}_{t, \hat{z}_0} \left[ (s_{\text{real}}(\Psi(\hat{z}_0, t), t) - s_{\text{fake}}(\Psi(\hat{z}_0, t), t)) \cdot \frac{\partial \hat{z}_0}{\partial \theta} \right]$$

</div>

where $s_{\text{real}}$ uses the frozen teacher with joint guidance (requiring 3 NFE per step), while $s_{\text{fake}}$ is a trainable critic without CFG. This "bakes" the expensive multi-term guidance into the distillation objective, allowing the student to replicate joint-guided quality with a single function evaluation.

<figure class="academic-figure" id="fig-motionstream-longvid" style="text-align: center; margin: 2rem auto; display: block;">
<video autoplay loop muted playsinline style="max-width: 95%; display: block; margin: 0 auto; border-radius: 8px;">
  <source src="https://joonghyuk.com/motionstream-web/assets/long_video/sample2_3_1_1.mp4" type="video/mp4">
</video>
<figcaption data-caption="Long video generation with MotionStream. The model generates indefinitely long sequences while maintaining quality, thanks to attention sinks that anchor generation to the initial frame."></figcaption>
</figure>

Experiments reveal that minimal configurations work best. A single sink chunk ($S = 1$) with a single-chunk local window ($W = 1$) outperforms larger windows during long-video extrapolation. Additional sink chunks provide marginal gains while increasing latency. Larger windows actually degrade quality because attending to long-past history allows errors to accumulate in context tokens. The minimal configuration forces the model to compress all relevant history into the immediate predecessor and initial anchor.

For maximum speed, MotionStream introduces a **Tiny VAE** decoder trained with adversarial loss and LPIPS regression against the original VAE's latent space. This reduces decoding time by over 10×, removing the VAE bottleneck that otherwise consumes 35-47% of wall time. The final system achieves 17 FPS at 480p with full VAE (0.69s latency) or 29.5 FPS with Tiny VAE (0.39s latency) on a single H100. For 720p, the numbers are 10.4 FPS and 23.9 FPS respectively. On motion transfer benchmarks, MotionStream matches or exceeds prior offline methods (Go-With-The-Flow, Diffusion-As-Shader) while being 20-40× faster.

The limitation is that attention sinks anchor generation to the initial scene. For applications requiring complete scene changes (game world exploration where environments continuously change), the model tends to preserve initial features rather than adapting to new contexts. This is a fundamental constraint of the track-based conditioning, which cannot meaningfully encode full scene transitions.

## Accelerating Diffusion with Distribution Matching

The speed improvements in CausVid and Self Forcing rely heavily on reducing the number of denoising steps. Standard diffusion requires 50-100 steps; few-step diffusion achieves comparable quality in 4 steps. This compression is enabled by **distribution matching distillation**.

The key idea, introduced in DMD <cite data-key="dmd2_2024"></cite>, is to minimize the KL divergence between the generated and target distributions at the output level, rather than matching individual denoising steps.

Recall that the score function relates to the noise prediction via $s_\theta(x_t, t) = -\epsilon_\theta(x_t, t)/\sigma_t$ (from <a href="#eq-score" class="eqref"></a>). The gradient of the reverse KL divergence can be written as:

<div class="academic-equation" id="eq-dmd-gradient">

$$\nabla_\phi D_{\text{KL}}(p_{\text{gen},t} \| p_{\text{data},t}) = \mathbb{E}_{x_t \sim p_{\text{gen},t}}\left[ (s_{\text{gen}}(x_t, t) - s_{\text{data}}(x_t, t)) \nabla_\phi \log p_{\text{gen},t}(x_t) \right]$$

</div>

The second term $\nabla_\phi \log p_{\text{gen},t}(x_t)$ is handled through the reparameterization trick. For a generator $G_\phi(\epsilon)$ with $\epsilon \sim \mathcal{N}(0, I)$, after applying the forward process and taking expectations:

<div class="academic-equation" id="eq-dmd-practical">

$$\nabla_\phi \mathcal{L}_{\text{DMD}} \approx -\mathbb{E}_{t, \epsilon} \left[ \omega(t) \left( s_{\text{data}}(\hat{x}_t, t) - s_{\text{gen}}(\hat{x}_t, t) \right) \frac{\partial \hat{x}}{\partial \phi} \right]$$

</div>

where $\hat{x} = G_\phi(\epsilon)$, $\hat{x}_t = \Psi(\hat{x}, t)$, and $\omega(t)$ is a weighting function.

The score $s_{\text{data}}$ pulls the generator output toward real data. The score $s_{\text{gen}}$ pushes away from the generator's current distribution. Together they form a gradient that moves the generator's distribution toward the data distribution.

DMD2 extends this to multi-step generation by replacing the pure noise input $\epsilon$ with a partially denoised intermediate $x_t$. It also introduces the **two-timescale update rule**, where the generator $G_\phi$ is updated more frequently than the online score network $s_{\text{gen},\xi}$. Specifically, the ratio is typically 5:1, which stabilizes training by preventing the fake score network from adapting too quickly to generator changes.

What makes DMD particularly suitable for causal video generation is that the teacher and student can have different architectures. The teacher can be bidirectional (higher quality, slower). The student can be causal (lower quality without distillation, but fast with KV caching). The distribution matching objective only requires samples from both; it does not require the architectures to match.

This flexibility is crucial. A causal teacher would suffer from the same error accumulation as the student. By using a bidirectional teacher, we transfer the teacher's robustness to the student without requiring the student to be bidirectional.

## Memory for Minutes: Mixture of Contexts

Attention is quadratic in sequence length. A minute-long 480p video at 12 FPS, after VAE compression (16× spatial, 4× temporal downsampling), becomes a sequence of approximately 180,000 tokens. Standard self-attention over this sequence becomes computationally intractable. For even longer videos, the numbers become astronomical.

Sparse attention is the natural solution, but which tokens should attend to which? Fixed sparsity patterns (local windows, strided attention) cannot adapt to the content. A reference to an object that appeared 30 seconds ago requires attending to those specific frames, not a fixed window. Prior methods either compress history into lossy summaries (keyframes, latent states) or impose static sparse patterns that cannot adapt to which past events matter at each step.

**Mixture of Contexts (MoC)** <cite data-key="moc_2025"></cite> reframes long-context video generation as an *internal information retrieval* problem. Rather than attending to all context or using fixed sparsity, each query token dynamically selects only the most relevant chunks of context through a learned sparse attention routing mechanism.

The key insight is that video data exhibits high temporal redundancy, and spatially/temporally adjacent tokens often represent redundant or correlated visual elements. MoC partitions the multi-modal token stream into **content-aligned chunks** along natural boundaries (frames, shots, and modality stripes) rather than fixed-length windows. This ensures each chunk is semantically homogeneous, making the routing signal more discriminative.

<figure class="academic-figure" id="fig-moc" style="text-align: center; margin: 2rem auto; display: block;">
<video autoplay loop muted playsinline style="max-width: 95%; display: block; margin: 0 auto; border-radius: 8px;">
  <source src="https://primecai.github.io/moc/videos/overview_video.mp4" type="video/mp4">
</video>
<figcaption data-caption="Minute-long multi-shot video generation with Mixture of Contexts. The model maintains coherence across scene transitions by learning which historical context to attend to."></figcaption>
</figure>

For every query token $q_i$, MoC computes a relevance score against each chunk using a **parameter-free router**: it takes the dot product between $q_i$ and a mean-pooled descriptor $\phi(K_\omega) = \text{mean}(K_\omega)$ of each chunk's keys. The top-$k$ most relevant chunks are selected:

<div class="academic-equation" id="eq-moc-attention">

$$\text{Attn}(q_i, K, V) = \text{softmax}\left( \frac{q_i K_{\Omega(q_i)}^\top}{\sqrt{d}} \right) V_{\Omega(q_i)}$$

</div>

where $\Omega(q_i)$ is the set of indices for the top-$k$ selected chunks. The mean-pooling descriptor is remarkably effective because, as shown in prior work on denoising diffusion autoencoders, diffusion transformers learn semantically meaningful representations where the mean of a token chunk effectively captures its dominant semantic content.

Crucially, the router is **parameter-free** yet trainable. While the top-$k$ selection itself is non-differentiable, the model learns indirectly through the attention mechanism on selected chunks. If a selected chunk proves irrelevant, gradients from the loss flow back through its keys/values, attenuating unhelpful representations and encouraging more discriminative query/key projections over training.

MoC introduces several design elements that ensure robust routing:

- **Mandatory anchors**: Every visual query always attends to (1) all text/caption tokens (providing semantic grounding) and (2) tokens within the same shot (ensuring local coherence). This reserves routing capacity for genuinely long-range recall.
- **Causal routing**: To prevent pathological feedback loops where chunk $i$ routes to chunk $j$ while $j$ routes back to $i$, MoC imposes a causal mask restricting each chunk to attend only to earlier positions, transforming the routing graph into a directed acyclic graph.
- **Per-head distributed routing**: Rather than selecting a global set of chunks for the entire network, routing operates independently for each attention head in every layer. Different heads specialize in distinct feature subspaces, and the union of selected chunks across all heads covers a large portion of the context.
- **Context drop-in/drop-out**: During training, randomly removing selected chunks (drop-out) and injecting extraneous chunks (drop-in) promotes robustness to routing errors and prevents "dead route" problems analogous to dead experts in Mixture-of-Experts systems.

MoC achieves dramatic efficiency gains. For 8-shot, minute-long scenes with approximately 180,000 tokens, MoC prunes about 85% of token pairs and reduces attention FLOPs by over 7×, yielding a measured 2.2× end-to-end generation speedup. Importantly, this sparsity does not compromise quality—the model often *improves* on metrics like Dynamic Degree (motion diversity) while maintaining consistency, because compute is reallocated from redundant frames to salient visual events.

This connects to a deeper insight about video structure. Videos are not uniformly dense in information. Long static shots contain redundant frames. Key events (scene transitions, object appearances, action changes) carry disproportionate information. A good video model should allocate attention according to information content, not uniform temporal distance. MoC learns this allocation end-to-end, without explicit heuristics like Field-of-View overlapping or 3D geometric priors.

## Beyond Pixels: Latent Space World Models

A recurring theme in the papers discussed so far is that generation happens in latent space. A 3D VAE compresses video frames into shorter sequences of latent tokens. The diffusion model operates on these latents. A decoder converts latents back to pixels.

This design has several advantages. Latents are lower-dimensional than pixels, so diffusion is cheaper. Latents are more semantically meaningful, so learning is easier. Compression removes perceptually irrelevant details, focusing the model on structure.

But there is a deeper question. For world modeling, do we even need to predict pixels? If the goal is planning, control, or understanding, we only need a representation that supports downstream tasks. Predicting full RGB frames may be wasteful.

**V-JEPA 2** <cite data-key="vjepa2_2025"></cite> takes this direction to the extreme. It predicts in the latent space of a pretrained DINOv2 encoder, never touching pixels at all. The model learns an action-conditioned world model from internet video, predicting how latent representations evolve given actions.

This latent-space prediction has advantages for control. The latent space is invariant to irrelevant visual details (lighting changes, textures). Planning in this space focuses on task-relevant structure.

**DINO-world** <cite data-key="dino_world_2025"></cite> similarly operates in DINOv2 latent space, showing strong intuitive physics understanding. Objects that should move together do move together. Occlusion is handled correctly. Physical plausibility emerges from prediction in a semantically rich latent space.

The tradeoff is that these models cannot generate photorealistic video. They predict abstract representations, not renderable frames. But for world modeling applications (robotics, planning, simulation), this may not matter.

## 4D World Models: Geometry and Dynamics Together

Video is a 2D projection of a 3D world evolving in time. Standard video models treat frames as images, ignoring the underlying 3D structure. This leads to problems.

When the camera moves, a 2D video model must learn to reproject the scene from scratch. It does not know that rotating the camera by 10 degrees should produce a consistent view of the same 3D objects. Hallucinating consistent 3D structure from pure 2D supervision is hard.

**4D world models** address this by jointly predicting 3D structure and dynamics. Instead of outputting RGB frames, they output representations that decompose into geometry (depth, normals) and appearance (color, texture).

**TesserAct** <cite data-key="tesseract_2025"></cite> predicts RGB, depth, and surface normals (RGB-DN) jointly. The model is trained on videos with ground-truth depth (from simulation or RGBD sensors) and learns to predict all three modalities together. At inference, it can render novel views by reprojecting the predicted depth.

**Aether** <cite data-key="aether_2025"></cite> provides a unified framework for 4D dynamic reconstruction, action-conditioned video prediction, and goal-conditioned visual planning. The key insight is that these tasks share the same underlying representation. A model that understands 4D dynamics can perform all three.

<figure class="academic-figure" id="fig-aether" style="text-align: center; margin: 2rem auto; display: block;">
<img src="https://arxiv.org/html/2503.18945v2/x1.png" alt="Aether unified world model" style="max-width: 90%; display: block; margin: 0 auto;">
<figcaption data-caption="Aether provides geometry-aware unified world modeling, supporting 4D reconstruction, action-conditioned prediction, and goal-conditioned planning within a single framework."></figcaption>
</figure>

The geometry-aware representation has several benefits. **View synthesis** is possible by reprojecting predicted depth to novel cameras. **Physical reasoning** is easier when the model knows about 3D structure. **Generalization** improves because the model learns about the 3D world, not just 2D patterns.

The price is that training requires 3D supervision (depth, normals, camera poses), which is more expensive to collect than RGB video. But the resulting models are more capable world simulators.

## General World Models: Toward Unified Architectures

The papers discussed so far focus on specific aspects of the world modeling problem. A natural question is whether we can build a single model that handles all aspects.

**PAN** (Perception-Action Navigation) <cite data-key="pan_2025"></cite> combines an autoregressive LLM backbone with a video diffusion decoder. The LLM predicts compact latent actions and physics states. The diffusion decoder renders these predictions as video frames. This separation allows the model to reason about dynamics at a high level while delegating appearance generation to a specialized component.

The architecture is called **Generative Latent Prediction (GLP)**. The LLM operates on a sequence of latent tokens, one per frame. Each latent encodes the "state" of the world at that timestep. The diffusion decoder conditions on these latents to produce the actual RGB frames.

This design addresses the mismatch between discrete, symbolic reasoning (where LLMs excel) and continuous, perceptual generation (where diffusion excels). The LLM handles planning and physics. The diffusion model handles appearance.

## What Makes a World Model?

Let me step back and ask a deeper question. What distinguishes a world model from a video generator?

A video generator produces plausible video given a prompt. It may hallucinate objects that do not exist, violate physics, or generate inconsistent geometry. These are acceptable if the goal is entertainment or illustration.

A world model must do more. It must obey the constraints of the world it models. Objects have persistent identities. Actions have causal consequences. Physics is (mostly) conserved.

The papers discussed here represent different approaches to learning these constraints.

**Causal attention** enforces temporal causality. The future cannot influence the past.

**Self Forcing** enforces consistency with the model's own outputs. The model must handle its own mistakes.

**Attention sinks** enforce stable long-term generation. Anchoring to initial frames prevents drift during infinite-length rollouts.

**Distribution matching** enforces consistency with real video. Generated videos must be indistinguishable from real ones.

**Sparse attention (MoC)** enforces selective memory. The model must learn what past information is relevant.

**4D prediction** enforces geometric consistency. The 3D world must be coherent across views.

None of these alone creates a full world model. Together, they provide a foundation.

## Looking Forward

The field is moving fast. Several directions seem particularly promising.

**Longer context windows** are needed to capture the temporal structure of real activities. Current models handle seconds to minutes. Real tasks (cooking, assembly, navigation) unfold over hours.

**Better memory mechanisms** will be required. Mixture of Contexts is a step, but we likely need more structured representations. State-space models, persistent external memory, and retrieval-augmented generation are all possibilities.

**Unified training objectives** that combine generation, prediction, and planning would avoid the current fragmentation. A model trained only on generation may not understand causality. A model trained only on prediction may not generate high-quality samples.

**Better evaluation** is needed. Current benchmarks (VBench, FVD) focus on visual quality and text alignment. They do not measure physical plausibility, long-term consistency, or controllability.

**Scaling laws** for video world models are not well understood. Do these models scale like LLMs? Do they benefit from video-specific architectural choices? How much compute is needed for useful world simulators?

## Conclusion

The path from bidirectional video diffusion to autoregressive world models requires solving several interconnected problems. Causality must be imposed through attention masking. Error accumulation must be addressed through self-forcing or distribution matching. Inference must be accelerated through distillation and KV caching. Memory must be efficient through sparse attention. And for true world modeling, geometry and physics must be incorporated into the representation.

Each of the papers discussed here solves one piece of the puzzle. CausVid shows how to convert bidirectional to causal. Self Forcing bridges the train-test gap. MotionStream adds interactive control and attention sinks for infinite-length streaming. DMD2 enables few-step generation. Diffusion Forcing provides flexible noise scheduling. Mixture of Contexts enables long-range memory. TesserAct and Aether incorporate 4D structure.

The goal of photorealistic, real-time, physically plausible world simulation remains distant. But the trajectory is clear. Video generation is becoming video prediction. Video prediction is becoming world modeling. And world modeling is becoming a foundation for embodied AI.

<div class="bibliography-data" style="display:none;">
@inproceedings{causevid_2024,
  author    = {Yin, Tianwei and Zhang, Qiang and Zhang, Richard and Freeman, William T. and Durand, Frédo and Shechtman, Eli and Huang, Xun},
  title     = {From Slow Bidirectional to Fast Autoregressive Video Diffusion Models},
  booktitle = {arXiv preprint arXiv:2412.07772},
  year      = {2024},
  url       = {https://causvid.github.io/}
}
@inproceedings{self_forcing_2025,
  author    = {Huang, Xun and Li, Zhengqi and He, Guande and Zhou, Mingyuan and Shechtman, Eli},
  title     = {Self Forcing: Bridging the Train-Test Gap in Autoregressive Video Diffusion},
  booktitle = {NeurIPS},
  year      = {2025},
  url       = {https://self-forcing.github.io/}
}
@inproceedings{dmd2_2024,
  author    = {Yin, Tianwei and Gharbi, Michaël and Zhang, Richard and Shechtman, Eli and Durand, Frédo and Freeman, William T. and Park, Taesung},
  title     = {Improved Distribution Matching Distillation for Fast Image Synthesis},
  booktitle = {NeurIPS},
  year      = {2024},
  url       = {https://arxiv.org/abs/2405.14867}
}
@inproceedings{diffusion_forcing_2025,
  author    = {Chen, Boyuan and Martí Monsó, Diego and Du, Yilun and Simchowitz, Max and Tedrake, Russ and Sitzmann, Vincent},
  title     = {Diffusion Forcing: Next-token Prediction Meets Full-Sequence Diffusion},
  booktitle = {NeurIPS},
  year      = {2025},
  url       = {https://boyuan.space/diffusion-forcing/}
}
@inproceedings{moc_2025,
  author    = {Cai, Shengqu and Yang, Ceyuan and Zhang, Lvmin and Guo, Yuwei and Xiao, Junfei and Yang, Ziyan and Xu, Yinghao and Yang, Zhenheng and Yuille, Alan and Guibas, Leonidas and Agrawala, Maneesh and Jiang, Lu and Wetzstein, Gordon},
  title     = {Mixture of Contexts for Long Video Generation},
  booktitle = {arXiv preprint arXiv:2508.21058},
  year      = {2025},
  url       = {https://primecai.github.io/moc/},
  note      = {Work done at ByteDance Seed}
}
@inproceedings{tesseract_2025,
  title={TesserAct: Learning 4D Embodied World Models},
  author={Zhen, Haoyu and Sun, Qiao and Zhang, Hongxin and Li, Junyan and Zhou, Siyuan and Du, Yilun and Gan, Chuang},
  journal={arXiv preprint arXiv:2504.20995},
  year={2025},
  url={https://arxiv.org/abs/2504.20995}
}
@inproceedings{aether_2025,
  title={Aether: Geometric-Aware Unified World Modeling},
  author={Zhu, Haoyi and Wang, Yifan and Zhou, Jianjun and Chang, Wenzheng and Zhou, Yang and Li, Zizun and Chen, Junyi and Shen, Chunhua and Pang, Jiangmiao and He, Tong},
  journal={arXiv preprint arXiv:2503.18945},
  year={2025},
  url={https://arxiv.org/abs/2503.18945}
}
@inproceedings{vjepa2_2025,
  title={V-JEPA 2: Self-Supervised Video Models Enable Understanding, Prediction and Planning},
  author={Assran, Mido and Bardes, Adrien and Fan, David and Garrido, Quentin and Howes, Russell and Komeili, Mojtaba and Muckley, Matthew and Rizvi, Ammar and Roberts, Claire and Sinha, Koustuv and Zholus, Artem and Arnaud, Sergio and Gejji, Abha and Martin, Ada and Hogan, Francois Robert and Dugas, Daniel and Bojanowski, Piotr and Khalidov, Vasil and Labatut, Patrick and Massa, Francisco and Szafraniec, Marc and Krishnakumar, Kapil and Li, Yong and Ma, Xiaodong and Chandar, Sarath and Meier, Franziska and LeCun, Yann and Rabbat, Michael and Ballas, Nicolas},
  journal={arXiv preprint arXiv:2506.09985},
  year={2025},
  url={https://arxiv.org/abs/2506.09985}
}
@inproceedings{dino_world_2025,
  title={Back to the Features: DINO as a Foundation for Video World Models},
  author={Baldassarre, Federico and Szafraniec, Marc and Terver, Basile and Khalidov, Vasil and Massa, Francisco and LeCun, Yann and Labatut, Patrick and Seitzer, Maximilian and Bojanowski, Piotr},
  journal={arXiv preprint arXiv:2507.19468},
  year={2025},
  url={https://arxiv.org/abs/2507.19468}
}
@inproceedings{pan_2025,
  title={PAN: A World Model for General, Interactable, and Long-Horizon World Simulation},
  author={Xiang, Jiannan and Gu, Yi and Liu, Zihan and Feng, Zeyu and Gao, Qiyue and Hu, Yiyan and Huang, Benhao and Liu, Guangyi and Yang, Yichi and Zhou, Kun and Abrahamyan, Davit and Ahmad, Arif and Bannur, Ganesh and Chen, Junrong and Chen, Kimi and Deng, Mingkai and Han, Ruobing and Huang, Xinqi and Kang, Haoqiang and Liu, Zheqi and Ma, Enze and Ren, Hector and Shinde, Yashowardhan and Shingre, Rohan and Tanikella, Ramsundar and Tao, Kaiming and Yang, Dequan and Yu, Xinle and Zeng, Cong and Zhou, Binglin and Liu, Zhengzhong and Hu, Zhiting and Xing, Eric P.},
  journal={arXiv preprint arXiv:2511.09057},
  year={2025},
  url={https://arxiv.org/abs/2511.09057}
}

@article{WilliamsZipser1989,
  author = {Williams, Ronald J. and Zipser, David},
  title = {A Learning Algorithm for Continually Running Fully Recurrent Neural Networks},
  journal = {Neural Computation},
  year = {1989},
  volume = {1},
  pages = {270--280},
  doi = {10.1162/neco.1989.1.2.270},
  publisher = {MIT Press},
  note = {Appears in Neural Computation, 1, pp. 270-280, 1989}
}
@inproceedings{motionstream_2025,
  author    = {Shin, Joonghyuk and Li, Zhengqi and Zhang, Richard and Zhu, Jun-Yan and Park, Jaesik and Shechtman, Eli and Huang, Xun},
  title     = {MotionStream: Real-Time Video Generation with Interactive Motion Controls},
  booktitle = {arXiv preprint arXiv:2511.01266},
  year      = {2025},
  url       = {https://joonghyuk.com/motionstream-web/}
}
@inproceedings{streamingllm_2023,
  author    = {Xiao, Guangxuan and Tian, Yuandong and Chen, Beidi and Han, Song and Lewis, Mike},
  title     = {Efficient Streaming Language Models with Attention Sinks},
  booktitle = {ICLR},
  year      = {2024},
  url       = {https://arxiv.org/abs/2309.17453}
}

</div>
