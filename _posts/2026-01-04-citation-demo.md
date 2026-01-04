---
layout: post
title: "Demo: Academic Numbering System for Jekyll"
author: Soran Ghaderi
image: https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1200
featured: false
hidden: true
comments: false
draft: true
excerpt: "This post demonstrates the LaTeX-like academic numbering system for Jekyll blog posts, featuring automatic numbering of figures, tables, equations, and algorithms with cross-references."
---

## Introduction

This post demonstrates the **academic numbering system** for Jekyll blog posts. Just like in LaTeX papers, you can now use automatically numbered figures, tables, equations, and algorithms with cross-references.

## Figures with Captions

Use the `figure` tag to create captioned, numbered figures:

{% figure id:fig-energy-landscape caption:"An example energy landscape showing two low-energy basins. Samples concentrate in regions of low energy (high probability)." %}
  <img src="https://soran-ghaderi.github.io/torchebm/latest/assets/images/e_functions/double_well.png" alt="Double Well Energy" style="max-width: 60%;">
{% endfigure %}

As shown in {% ref fig-energy-landscape %}, the energy function defines the probability landscape. Lower energy corresponds to higher probability.

## Tables with Captions

Tables can also be numbered and referenced:

{% table id:tab-samplers caption:"Comparison of sampling algorithms in TorchEBM" %}
| Sampler | Type | Use Case |
|---------|------|----------|
| Langevin Dynamics | MCMC | General sampling |
| HMC | MCMC | High-dimensional problems |
| Gradient Descent | Optimization | Mode finding |
| Nesterov | Optimization | Accelerated mode finding |
{% endtable %}

The sampling algorithms listed in {% ref tab-samplers %} each have different strengths depending on the application.

## Numbered Equations

For important equations that you want to reference, use the `equation` tag:

{% equation id:eq-boltzmann %}
p_\theta(x) = \frac{e^{-E_\theta(x)}}{Z_\theta}
{% endequation %}

The Boltzmann distribution in {% ref eq-boltzmann %} defines how probability relates to energy. The partition function is:

{% equation id:eq-partition %}
Z_\theta = \int e^{-E_\theta(x)} \, dx
{% endequation %}

From {% ref eq-boltzmann %} and {% ref eq-partition %}, we can derive the score function:

{% equation id:eq-score %}
s_\theta(x) = \nabla_x \log p_\theta(x) = -\nabla_x E_\theta(x)
{% endequation %}

The score function {% eqref eq-score %} is independent of the partition function, which is crucial for score-based generative modeling {% cite song2019generative %}.

## Algorithms

Algorithms can be formatted with proper numbering:

{% algorithm id:alg-langevin caption:"Langevin Dynamics Sampling" %}
Input: Energy function E(x), step size ε, number of steps K
Output: Sample x_K

1. Initialize x_0 ~ N(0, I)
2. for i = 0 to K-1 do
3.     z_i ~ N(0, I)
4.     x_{i+1} = x_i - ε∇E(x_i) + √(2ε) z_i
5. end for
6. return x_K
{% endalgorithm %}

The sampling procedure in {% ref alg-langevin %} converges to samples from the target distribution as ε → 0 and K → ∞.

## Multiple Figures

You can have multiple figures in a post:

{% figure id:fig-trajectory caption:"Langevin dynamics trajectory showing convergence to a low-energy basin." %}
  <img src="https://soran-ghaderi.github.io/torchebm/latest/assets/images/samplers/langevin_trajectory.png" alt="Langevin Trajectory" style="max-width: 55%;">
{% endfigure %}

Comparing {% ref fig-energy-landscape %} and {% ref fig-trajectory %}, we can see how the sampler explores the energy landscape.

## Cross-Reference Summary

This post demonstrates:
- **Figures**: {% ref fig-energy-landscape %}, {% ref fig-trajectory %}
- **Tables**: {% ref tab-samplers %}
- **Equations**: {% ref eq-boltzmann %}, {% ref eq-partition %}, {% ref eq-score %}
- **Algorithms**: {% ref alg-langevin %}

You can also use `eqref` for equation numbers only: {% eqref eq-boltzmann %}, {% eqref eq-score %}.

## Combined with Citations

The academic numbering system works seamlessly with the citation system {% cite lecun2006tutorial %}. Energy-based models {% cite hinton2002training %} use the formulation in {% ref eq-boltzmann %}.

{% bibliography %}
@article{lecun2006tutorial,
  author = {LeCun, Yann and Chopra, Sumit and Hadsell, Raia and Ranzato, Marc'Aurelio and Huang, Fu Jie},
  title = {A Tutorial on Energy-Based Learning},
  journal = {Predicting Structured Data},
  year = {2006},
  volume = {1},
  pages = {1--59},
  publisher = {MIT Press}
}

@inproceedings{hinton2002training,
  author = {Hinton, Geoffrey E.},
  title = {Training Products of Experts by Minimizing Contrastive Divergence},
  booktitle = {Neural Computation},
  year = {2002},
  volume = {14},
  number = {8},
  pages = {1771--1800},
  doi = {10.1162/089976602760128018}
}

@inproceedings{song2019generative,
  author = {Song, Yang and Ermon, Stefano},
  title = {Generative Modeling by Estimating Gradients of the Data Distribution},
  booktitle = {Advances in Neural Information Processing Systems},
  year = {2019},
  volume = {32},
  pages = {11895--11907},
  url = {https://arxiv.org/abs/1907.05600}
}
{% endbibliography %}
