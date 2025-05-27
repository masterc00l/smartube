from PIL import Image, ImageDraw
import os

def create_icon(size):
    # Create a new image with a transparent background
    image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    
    # Draw the circle background
    draw.ellipse([0, 0, size, size], fill='#4CAF50')
    
    # Draw the play button
    points = [
        (size * 0.4, size * 0.3),  # Left point
        (size * 0.4, size * 0.7),  # Bottom point
        (size * 0.7, size * 0.5),  # Right point
    ]
    draw.polygon(points, fill='white')
    
    # Save the image
    image.save(f'icons/icon{size}.png')

# Create icons directory if it doesn't exist
if not os.path.exists('icons'):
    os.makedirs('icons')

# Generate icons of different sizes
create_icon(16)
create_icon(48)
create_icon(128)

print("Icons generated successfully!") 