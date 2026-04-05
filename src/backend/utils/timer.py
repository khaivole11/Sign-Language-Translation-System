import time

class Timer:
    def __init__(self):
        self.times = {}

    def start(self, key):
        self.times[key] = time.time()

    def stop(self, key):
        self.times[key] = time.time() - self.times[key]

    def get(self):
        return self.times