import sys
import json
import cv2

SAMPLE_INTERVAL_SECONDS = 1.0
DOWNSCALE_WIDTH = 320


def main():
    video_path = sys.argv[1]
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

    capture = cv2.VideoCapture(video_path)
    fps = capture.get(cv2.CAP_PROP_FPS) or 30
    source_width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    source_height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = frame_count / fps if fps else 0

    frame_step = max(1, round(fps * SAMPLE_INTERVAL_SECONDS))
    scale = DOWNSCALE_WIDTH / source_width if source_width > DOWNSCALE_WIDTH else 1.0

    track = []
    frame_index = 0

    while True:
        ok = capture.grab()
        if not ok:
            break

        if frame_index % frame_step == 0:
            ok, frame = capture.retrieve()
            if ok:
                small = cv2.resize(frame, None, fx=scale, fy=scale) if scale != 1.0 else frame
                gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
                faces = cascade.detectMultiScale(gray, scaleFactor=1.15, minNeighbors=5, minSize=(40, 40))

                if len(faces):
                    x, y, w, h = max(faces, key=lambda box: box[2] * box[3])
                    cx = (x + w / 2) / scale
                    cy = (y + h / 2) / scale
                    track.append({'t': round(frame_index / fps, 3), 'cx': round(cx, 1), 'cy': round(cy, 1), 'found': True})
                else:
                    track.append({'t': round(frame_index / fps, 3), 'cx': None, 'cy': None, 'found': False})

        frame_index += 1

    capture.release()

    print(json.dumps({
        'sourceWidth': source_width,
        'sourceHeight': source_height,
        'duration': round(duration, 3),
        'track': track
    }))


if __name__ == '__main__':
    main()
