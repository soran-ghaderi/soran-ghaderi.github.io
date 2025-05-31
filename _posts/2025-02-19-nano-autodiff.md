---
layout: post
title:  Nano AutoDiff 
author: Soran Ghaderi

#categories: [ library, python, machine learning, deep learning, automatic differentiation ]

image: images/autodiff.png
featured: false
hidden: false
comments: true
excerpt: A from-scratch implementation of the following components with a Keras-like API
---


<!-- <h2 align="center"> <b><a target="_blank" href="https://github.com/soran-ghaderi/backpropagation">Nano Autodiff</a></b></h2> -->
A from-scratch implementation of the following components with a Keras-like API.</b> <br>

## features
 - Automatic differentiation and backpropagation
 - Dense, Sequential, Model layers
 - Adam optimizer, SGD 
 - MSE, RMSE, SimpleError 
 - Grid Search

This repository implements a simple multi-regressor MLP for controlling a lunar lander agent. This serves as a tutorial to get started with backpropagation and automatic differentiation.

You can easily extend this boilerplate to implement Conv1D, Conv2D, etc. layers.

Credits: The automatic differentiation is based on micrograd. Additions to Dr. Karpathy's implementation: are as follows:

 - Topological ordering using DP instead of recursion for speed and scalability
 - Support for division (the original implementation does not work)
 - Support for Sigmoid and Softmax activation functions
 - Resolve other minor errors

### Other features

 - Dense layer automatically extracts the input shape and dimension
 - DataProcessor
 - DataLoader
 - Early stopping
 - Save best weights

## Exmaple Usage

```python
original_file_path = 'data/ce889_dataCollection.csv'
normalized_output_path = 'data/normalized_data.csv'
data_processor = DataProcessor(original_file_path)
normalized_data = data_processor.normalize(save_path=normalized_output_path)
data_wrapper = NormalizedDataWrapper(original_file_path)
data_loader = DataLoader(file_path=normalized_output_path, validation_size=0.1)
# Load data
data_loader.load_data(1000)
# Split data into training, validation, and testing sets
inputs_train, inputs_val, inputs_test, outputs_train, outputs_val, outputs_test = data_loader.split_data()


beta1 = 0.9
beta2 = 0.999
lr = 0.1
clip_threshold = 1.0
activation_function = 'sigmoid'

model = Sequential([
    Dense(2, activation=activation_function),
    Dense(32, activation=activation_function),
    Dense(2) 
])

loss = MeanSquaredError()
optimizer = Adam(learning_rate=lr, beta1=beta1, beta2=beta2, clip_threshold=clip_threshold)
model.compile(optimizer=optimizer, loss=loss)

model.fit(inputs=inputs_train, outputs=outputs_train, val_inputs=inputs_val, val_outputs=outputs_val, batch_size=1, epochs=50, verbose=1,
          early_stopping={'min_delta': 0.001, 'patience': 5},
          save_best_model='./weights/best_model_weights.npy')

pred = model.predict(inputs_test)
evaluation_results = model.evaluate(inputs_test, outputs_test)
print("Evaluation Results after training:", evaluation_results)
```

