const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Notify admin when a new leave request is created
exports.onLeaveCreated = functions.firestore
  .document('leave_requests/{leaveId}')
  .onCreate(async (snap, context) => {
    const leave = snap.data();

    try {
      const adminTokenDoc = await admin.firestore()
        .collection('fcm_tokens')
        .doc('admin')
        .get();

      const adminTokenData = adminTokenDoc.data();
      const adminToken = adminTokenData && adminTokenData.token;

      if (!adminToken) {
        console.log('No admin token found');
        return null;
      }

      const payload = {
        notification: {
          title: 'New Leave Request',
          body: `${leave.name} has requested leave from ${leave.startDate} to ${leave.endDate}`,
        },
        data: {
          leaveId: leave.applicationId,
        },
      };

      return admin.messaging().sendToDevice(adminToken, payload);
    } catch (error) {
      console.error('Error notifying admin:', error);
      return null;
    }
  });

// Notify user when their leave request is updated (Approved/Rejected)
exports.onLeaveUpdated = functions.firestore
  .document('leave_requests/{leaveId}')
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const oldData = change.before.data();

    // Only send notification if status changed to Approved or Rejected
    if (
      newData.status !== oldData.status &&
      (newData.status === 'Approved' || newData.status === 'Rejected')
    ) {
      try {
        const userTokenDoc = await admin.firestore()
          .collection('fcm_tokens')
          .doc(newData.userId)
          .get();

        const userTokenData = userTokenDoc.data();
        const userToken = userTokenData && userTokenData.token;

        if (!userToken) {
          console.log(`No token found for user ${newData.userId}`);
          return null;
        }

        const payload = {
          notification: {
            title: `Leave ${newData.status}`,
            body: `Your leave from ${newData.startDate} to ${newData.endDate} has been ${newData.status.toLowerCase()} by the admin.`,
          },
          data: {
            leaveId: newData.applicationId,
          },
        };

        return admin.messaging().sendToDevice(userToken, payload);
      } catch (error) {
        console.error('Error notifying user:', error);
        return null;
      }
    }

    return null;
  });
