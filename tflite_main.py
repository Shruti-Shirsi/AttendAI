import cv2
import face_recognition
import numpy as np
import tensorflow as tf
import os

# Paths (ensure these match your actual file locations)
MODEL_PATH = 'converted_tflite/model_unquant.tflite'
LABELS_PATH = 'converted_tflite/labels.txt'

def load_labels(path):
    """Loads labels from a text file."""
    if not os.path.exists(path):
        return {}
    with open(path, 'r') as f:
        # Assumes format: "0 Name"
        return {i: line.strip().split(' ', 1)[1] for i, line in enumerate(f.readlines())}

def main():
    # Load TFLite model and allocate tensors
    print("Initializing TFLite Interpreter...")
    try:
        interpreter = tf.lite.Interpreter(model_path=MODEL_PATH)
        interpreter.allocate_tensors()
    except Exception as e:
        print(f"Error loading TFLite model: {e}")
        return

    # Get input and output details
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    _, height, width, _ = input_details[0]['shape']

    # Load labels
    labels = load_labels(LABELS_PATH)
    if not labels:
        print(f"Warning: No labels found in {LABELS_PATH}")
    else:
        print(f"Loaded labels: {labels}")

    # Initialize Webcam
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return

    print("\nStarting Face Recognition System...")
    print("Press 'q' to exit.")

    while True:
        success, frame = cap.read()
        if not success:
            print("Failed to grab frame.")
            break

        # 1. Face Detection using face_recognition (More stable than MediaPipe on Python 3.13)
        # We process a smaller frame for faster detection
        small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
        rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
        
        # Find all the faces in the current frame
        face_locations = face_recognition.face_locations(rgb_small_frame)

        # 2. Process each detected face
        for (top, right, bottom, left) in face_locations:
            # Scale back up face locations since the frame we detected in was scaled to 1/4 size
            top *= 4
            right *= 4
            bottom *= 4
            left *= 4

            # Crop face from original frame
            # Ensure coordinates are within image boundaries
            ih, iw, _ = frame.shape
            top, left = max(0, top), max(0, left)
            bottom, right = min(ih, bottom), min(iw, right)
            
            face_img = frame[top:bottom, left:right]
            
            if face_img.size == 0:
                continue

            # 3. Face Classification using TFLite Model
            # Preprocess: Convert BGR to RGB, Resize, Expand Dim, and Normalize
            face_rgb = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)
            face_resized = cv2.resize(face_rgb, (width, height))
            input_data = np.expand_dims(face_resized, axis=0).astype(np.float32)
            
            # Normalize (Teachable Machine standard: -1 to 1)
            input_data = (input_data / 127.5) - 1

            # Run inference
            interpreter.set_tensor(input_details[0]['index'], input_data)
            interpreter.invoke()
            output_data = interpreter.get_tensor(output_details[0]['index'])
            
            # Get prediction result
            idx = np.argmax(output_data[0])
            confidence = output_data[0][idx]
            name = labels.get(idx, "Unknown")
            
            # 4. Display Results
            # Set color: Green for high confidence, Red for low/unknown
            color = (0, 255, 0) if confidence > 0.7 else (0, 0, 255)
            
            # Draw bounding box
            cv2.rectangle(frame, (left, top), (right, bottom), color, 2)
            
            # Draw label background
            cv2.rectangle(frame, (left, bottom - 30), (right, bottom), color, cv2.FILLED)
            
            # Draw name and confidence
            display_text = f"{name} ({confidence:.2%})"
            cv2.putText(frame, display_text, (left + 6, bottom - 6),
                        cv2.FONT_HERSHEY_DUPLEX, 0.6, (255, 255, 255), 1)

        # Show the resulting image
        cv2.imshow('Multi-Face Recognition (TFLite + Face Recognition)', frame)
        
        # Exit on 'q'
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()

