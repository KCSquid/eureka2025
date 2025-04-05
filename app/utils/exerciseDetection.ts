import * as poseDetection from '@tensorflow-models/pose-detection';
import { Camera } from 'expo-camera';
import * as tf from '@tensorflow/tfjs';

type Exercise = 'pushups' | 'situps' | 'squats' | 'jumpingjacks';

export class ExerciseDetector {
  private detector: poseDetection.PoseDetector;
  private camera: any;
  private currentExercise: Exercise;
  private requiredReps: number = 5;
  private completedReps: number = 0;
  private lastPose: poseDetection.Pose | null = null;

  constructor(detector: poseDetection.PoseDetector, exercise: Exercise) {
    this.detector = detector;
    this.currentExercise = exercise;
  }

  setCamera(camera: any) {
    this.camera = camera;
  }

  async detectExercise(): Promise<boolean> {
    if (!this.camera) return false;

    try {
      const photo = await this.camera.takePictureAsync({
        quality: 1,
        base64: true,
      });

      if (!photo.base64) return false;

      // Convert base64 to tensor
      const imageTensor = tf.browser.fromPixels(photo.base64);

      // Detect poses
      const poses = await this.detector.estimatePoses(imageTensor);

      if (poses.length === 0) return false;

      const currentPose = poses[0];
      const isValidRep = this.checkExerciseRep(currentPose);

      if (isValidRep) {
        this.completedReps++;
        if (this.completedReps >= this.requiredReps) {
          return true;
        }
      }

      this.lastPose = currentPose;
      return false;
    } catch (error) {
      console.error('Error detecting exercise:', error);
      return false;
    }
  }

  private checkExerciseRep(pose: poseDetection.Pose): boolean {
    switch (this.currentExercise) {
      case 'pushups':
        return this.checkPushup(pose);
      case 'situps':
        return this.checkSitup(pose);
      case 'squats':
        return this.checkSquat(pose);
      case 'jumpingjacks':
        return this.checkJumpingJack(pose);
      default:
        return false;
    }
  }

  private checkPushup(pose: poseDetection.Pose): boolean {
    // Get keypoints for shoulders and elbows
    const leftShoulder = pose.keypoints.find(k => k.name === 'left_shoulder');
    const rightShoulder = pose.keypoints.find(k => k.name === 'right_shoulder');
    const leftElbow = pose.keypoints.find(k => k.name === 'left_elbow');
    const rightElbow = pose.keypoints.find(k => k.name === 'right_elbow');

    if (!leftShoulder || !rightShoulder || !leftElbow || !rightElbow) return false;

    // Check if elbows are bent at approximately 90 degrees
    const leftAngle = this.calculateAngle(
      { x: leftShoulder.x, y: leftShoulder.y },
      { x: leftElbow.x, y: leftElbow.y },
      { x: leftElbow.x, y: leftShoulder.y }
    );
    const rightAngle = this.calculateAngle(
      { x: rightShoulder.x, y: rightShoulder.y },
      { x: rightElbow.x, y: rightElbow.y },
      { x: rightElbow.x, y: rightShoulder.y }
    );

    return Math.abs(leftAngle - 90) < 30 && Math.abs(rightAngle - 90) < 30;
  }

  private checkSitup(pose: poseDetection.Pose): boolean {
    // Get keypoints for shoulders and hips
    const leftShoulder = pose.keypoints.find(k => k.name === 'left_shoulder');
    const rightShoulder = pose.keypoints.find(k => k.name === 'right_shoulder');
    const leftHip = pose.keypoints.find(k => k.name === 'left_hip');
    const rightHip = pose.keypoints.find(k => k.name === 'right_hip');

    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return false;

    // Check if torso is at approximately 45 degrees
    const angle = this.calculateAngle(
      { x: leftShoulder.x, y: leftShoulder.y },
      { x: leftHip.x, y: leftHip.y },
      { x: leftHip.x, y: leftShoulder.y }
    );

    return Math.abs(angle - 45) < 30;
  }

  private checkSquat(pose: poseDetection.Pose): boolean {
    // Get keypoints for hips and knees
    const leftHip = pose.keypoints.find(k => k.name === 'left_hip');
    const rightHip = pose.keypoints.find(k => k.name === 'right_hip');
    const leftKnee = pose.keypoints.find(k => k.name === 'left_knee');
    const rightKnee = pose.keypoints.find(k => k.name === 'right_knee');

    if (!leftHip || !rightHip || !leftKnee || !rightKnee) return false;

    // Check if knees are bent at approximately 90 degrees
    const leftAngle = this.calculateAngle(
      { x: leftHip.x, y: leftHip.y },
      { x: leftKnee.x, y: leftKnee.y },
      { x: leftKnee.x, y: leftHip.y }
    );
    const rightAngle = this.calculateAngle(
      { x: rightHip.x, y: rightHip.y },
      { x: rightKnee.x, y: rightKnee.y },
      { x: rightKnee.x, y: rightHip.y }
    );

    return Math.abs(leftAngle - 90) < 30 && Math.abs(rightAngle - 90) < 30;
  }

  private checkJumpingJack(pose: poseDetection.Pose): boolean {
    // Get keypoints for shoulders and wrists
    const leftShoulder = pose.keypoints.find(k => k.name === 'left_shoulder');
    const rightShoulder = pose.keypoints.find(k => k.name === 'right_shoulder');
    const leftWrist = pose.keypoints.find(k => k.name === 'left_wrist');
    const rightWrist = pose.keypoints.find(k => k.name === 'right_wrist');

    if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist) return false;

    // Check if arms are raised above shoulders
    return (
      leftWrist.y < leftShoulder.y &&
      rightWrist.y < rightShoulder.y
    );
  }

  private calculateAngle(
    point1: { x: number; y: number },
    point2: { x: number; y: number },
    point3: { x: number; y: number }
  ): number {
    const v1 = { x: point1.x - point2.x, y: point1.y - point2.y };
    const v2 = { x: point3.x - point2.x, y: point3.y - point2.y };
    const dotProduct = v1.x * v2.x + v1.y * v2.y;
    const magnitude1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const magnitude2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    const angle = Math.acos(dotProduct / (magnitude1 * magnitude2));
    return (angle * 180) / Math.PI;
  }
} 