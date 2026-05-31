from manim import *
import numpy as np

class DancingCat(Scene):
    def construct(self):
        # Create a simple cat shape using a combination of circles and polygons
        # Head
        head = Circle(radius=0.8, color=WHITE, fill_opacity=1)
        head.set_fill(color="#FFA500") # Orange cat
        
        # Ears
        left_ear = Triangle().scale(0.4).shift(UP * 0.6 + LEFT * 0.5)
        right_ear = Triangle().scale(0.4).shift(UP * 0.6 + RIGHT * 0.5)
        left_ear.set_fill(color="#FFA500", opacity=1)
        right_ear.set_fill(color="#FFA500", opacity=1)
        
        # Eyes
        left_eye = Circle(radius=0.15, color=BLACK, fill_opacity=1).shift(UP * 0.2 + LEFT * 0.3)
        right_eye = Circle(radius=0.15, color=BLACK, fill_opacity=1).shift(UP * 0.2 + RIGHT * 0.3)
        
        # Nose
        nose = Triangle().scale(0.1).shift(DOWN * 0.1)
        nose.set_fill(color="PINK", opacity=1)
        
        # Group everything
        cat = VGroup(head, left_ear, right_ear, left_eye, right_eye, nose)
        
        # Add a floor
        floor = Line(start=LEFT*4, end=RIGHT*4).shift(DOWN*2)
        
        # Title
        title = Text("Dancing Cat!", font_size=48).to_edge(UP)
        title.set_color_by_gradient(BLUE, PINK)
        
        self.add(floor, title)
        self.play(Create(cat), run_time=1)
        
        # Define the dance moves
        # We will make the cat bounce, rotate, and wiggle
        
        # Animation loop simulation
        dance_sequence = []
        
        # Move 1: Bounce
        bounce_up = cat.animate.shift(UP * 0.5).scale(1.1)
        bounce_down = cat.animate.shift(DOWN * 0.5).scale(0.9)
        
        # Move 2: Spin
        spin_left = cat.animate.rotate(PI/4, axis=OUT)
        spin_right = cat.animate.rotate(-PI/4, axis=OUT)
        
        # Move 3: Wiggle (stretch)
        wiggle_left = cat.animate.stretch(1.2, dim=0).shift(LEFT * 0.2)
        wiggle_right = cat.animate.stretch(1.2, dim=0).shift(RIGHT * 0.2)
        
        # Execute Dance
        music_beat = 0.5
        
        # Sequence
        self.play(bounce_up, run_time=music_beat)
        self.play(bounce_down, run_time=music_beat)
        self.play(spin_left, run_time=music_beat)
        self.play(spin_right, run_time=music_beat)
        self.play(wiggle_left, run_time=music_beat)
        self.play(wiggle_right, run_time=music_beat)
        
        # Repeat with variations
        self.play(cat.animate.shift(UP*0.3).rotate(PI/6), run_time=0.4)
        self.play(cat.animate.shift(DOWN*0.3).rotate(-PI/6), run_time=0.4)
        
        # Finale: Jump and pose
        self.play(cat.animate.shift(UP*1.5).scale(1.2), run_time=0.5)
        self.play(cat.animate.shift(DOWN*1.5).scale(1.0), run_time=0.5)
        
        # Final pose
        self.play(cat.animate.shift(RIGHT*0.5).rotate(PI/12), run_time=0.5)
        
        # Wait
        self.wait(1)
        
        # Fade out
        self.play(FadeOut(cat), FadeOut(title), run_time=1)