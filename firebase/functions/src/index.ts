import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {UserRecord} from "firebase-functions/lib/providers/auth";

admin.initializeApp();

const db = admin.firestore();
const region = functions.config().clothingloop.region as string;
const adminEmails = (
  functions.config().clothingloop.admin_emails as string
).split(";");

const ROLE_ADMIN = "admin";
const ROLE_CHAINADMIN = "chainAdmin";

// https://github.com/firebase/firebase-js-sdk/issues/1881
// If we want to use try/catch with auth functions, we have to wrap it in this
// Auth functions return a "clojure" promise which has a different catch implementation
function wrapInECMAPromise<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    return fn()
      .then((res) => resolve(res))
      .catch((err) => reject(err));
  });
}

export const createUser = functions
  .region(region)
  .https.onCall(async (data: any) => {
    functions.logger.debug("createUser parameters", data);
    const [
      email,
      chainId,
      name,
      phoneNumber,
      newsletter,
      interestedSizes,
      address,
    ] = [
      data.email,
      data.chainId,
      data.name,
      data.phoneNumber,
      data.newsletter,
      data.interestedSizes,
      data.address,
    ];
    let userRecord = null as null | UserRecord;
    try {
      userRecord = await wrapInECMAPromise<UserRecord>(() =>
        admin.auth().createUser({
          email: email,
          phoneNumber: phoneNumber,
          displayName: name,
          disabled: false,
        })
      );
    } catch (e) {
      functions.logger.warn(`Error creating user: ${JSON.stringify(e)}`);
      return {validationError: e};
    }
    functions.logger.debug("created user", userRecord);
    const verificationLink = await admin
      .auth()
      .generateEmailVerificationLink(email, {
        handleCodeInApp: false,
        url: functions.config().clothingloop.base_domain,
      });
    const verificationEmail = `<p>Hello ${name} and welcome to the Clothing Loop!,</p>

      <p>Thank you for making the step to create a more sustainable world together.</p>
      <p>We are super happy to have you. Please find our manual in the attachment to see how to proceed.</p>

      <p>Firstly, we need you to verify your email address by clicking  <a href="${verificationLink}">here</a></p>

      <p>Next steps for loop hosts:"
      <p>Right now everything is set up, but the loop is not live. When you are ready, login and navigate to the admin tab. To make the loop active, set the slider to 'visible'.</p>
      <p>Don't wait too long, as someone else may beat you to the chase and start a loop in the same area. And even though there can be multiple loops in the same area, it may cause a bit of confusion.</p>
     
      <p>Next steps for participants:</p>
      <p>What happens next?</p>
      <p>Each Loop has a local host that coordinates the specific Loop voluntarily. He/she/they will receive your application, and get in touch with further info. Please be patient, sometimes this can take up to four weeks, depending on the available time of the host.</p>
      <p>Of course, you want to start swapping right away, which we applaud obviously!</p>
      <p>What you can do in the meantime is start scanning your closet for items that are ready to go on adventures with somebody else.</p>
      <p>You can check if they need some repairs, depilling or a little wash, so they will become an even better addition to our travelling swap bags. </p>
      <p>Please note, it's a mutual effort to keep the bag a surprise for everyone. This way we are not just passing on a bag of clothes but a bag of happy stories and care!</p>
      <p>Don't worry if you do not find something in the very first bag. </p>

      <p>Furthermore, we love to grow as fast as possible to make the most impact. The sooner the better! So, another thing you can help us with is spread the word amongst your family, friends and neighbours. The earth will be eternally grateful.</p>
      <p>Happy swapping!</p>

      <p>Regards,</p>
      <p>The Clothing Loop team: Nichon, Paloeka, Giulia and Mirjam</p>`;
    functions.logger.debug("sending verification email", verificationEmail);
    await db.collection("mail").add({
      to: email,
      message: {
        subject: "Verify e-mail for clothing chain",
        html: verificationEmail,
      },
    });
    functions.logger.debug("Adding user supplemental information to firebase");
    await db.collection("users").doc(userRecord.uid).set({
      chainId,
      address,
      newsletter,
      interestedSizes,
    });
    if (adminEmails.includes(email)) {
      functions.logger.debug(`Adding user ${email} as admin`);
      await admin.auth().setCustomUserClaims(userRecord.uid, {
        role: ROLE_ADMIN,
        chainId: chainId,
      });
    } else {
      await admin
        .auth()
        .setCustomUserClaims(userRecord.uid, {chainId: chainId});
    }
    // TODO: Subscribe user in mailchimp if needed
    return {id: userRecord.uid};
  });

export const createChain = functions
  .region(region)
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    functions.logger.debug("createChain parameters", data);

    const [
      uid,
      name,
      description,
      address,
      latitude,
      longitude,
      radius,
      categories,
    ] = [
      data.uid,
      data.name,
      data.description,
      data.address,
      data.latitude,
      data.longitude,
      data.radius,
      data.categories,
    ];

    const user = await admin.auth().getUser(uid);
    const userData = await db.collection("users").doc(uid).get();
    if (
      (!userData.get("chainId") &&
        !user.customClaims?.chainId &&
        user.customClaims?.role !== ROLE_CHAINADMIN) ||
      context.auth?.token.role === ROLE_ADMIN
    ) {
      const chainData = await db.collection("chains").add({
        name,
        description,
        address,
        latitude,
        longitude,
        radius,
        categories,
        published: false,
        chainAdmin: uid,
      });
      db.collection("users").doc(uid).update("chainId", chainData.id);
      await admin.auth().setCustomUserClaims(uid, {
        chainId: chainData.id,
        role: user.customClaims?.role ?? ROLE_CHAINADMIN,
      });
      return {id: chainData.id};
    } else {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You don't have permission to change this user's chain"
      );
    }
  });

export const addUserToChain = functions
  .region(region)
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    functions.logger.debug("updateUserToChain parameters", data);

    const {uid, chainId} = data;

    if (context.auth?.uid === uid || context.auth?.token?.role === ROLE_ADMIN) {
      const userReference = db.collection("users").doc(uid);
      if ((await userReference.get()).get("chainId") === chainId) {
        functions.logger.warn(
          `user ${uid} is already member of chain ${chainId}`
        );
      } else {
        await userReference.update("chainId", chainId);
        // When switching chains, you're no longer an chain-admin
        if (context.auth?.token?.role === ROLE_CHAINADMIN) {
          await admin.auth().setCustomUserClaims(uid, {chainId: chainId});
        } else {
          await admin.auth().setCustomUserClaims(uid, {
            chainId: chainId,
            role: context.auth?.token?.role,
          });
        }

        await notifyChainAdmin(chainId, uid);
      }
    } else {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You don't have permission to change this user's chain"
      );
    }
  });

const notifyChainAdmin = async (chainId: string, newUserId: string) => {
  const chain = await db.collection("chains").doc(chainId).get();
  const chainAdminUid = await chain.get("chainAdmin");

  const chainAdmin = await admin.auth().getUser(chainAdminUid);
  const adminName = chainAdmin.displayName;
  const adminEmail = chainAdmin.email;

  const newUser = await admin.auth().getUser(newUserId);
  const name = newUser.displayName;
  const email = newUser.email;
  const phone = newUser.phoneNumber;

  await db.collection("mail").add({
    to: adminEmail,
    message: {
      subject: "A participant just joined your Loop!",
      html: ` <p>Hi, ${adminName}</p>
                        <p>A new participant just joined your loop.</p>
                        <p>Please find below the participant's contact information:</p>
                        <ul>
                          <li>Name: ${name}</li>
                          <li>Email: ${email}</li>
                          <li>Phone: ${phone}</li>
                        </ul>
                        <p>Best,</p>
                        <p>The Clothing Loop team</p>
                `,
    },
  });
};

export const updateUser = functions
  .region(region)
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    functions.logger.debug("updateUser parameters", data);
    const [uid, name, phoneNumber, newsletter, interestedSizes, address] = [
      data.uid,
      data.name,
      data.phoneNumber,
      data.newsletter,
      data.interestedSizes,
      data.address,
    ];

    if (context.auth?.uid === uid || context.auth?.token?.role === ROLE_ADMIN) {
      const userRecord = await admin.auth().updateUser(uid, {
        phoneNumber: phoneNumber,
        displayName: name,
        disabled: false,
      });
      functions.logger.debug("updated user", userRecord);
      await db.collection("users").doc(userRecord.uid).set(
        {
          address,
          newsletter,
          interestedSizes,
        },
        {merge: true}
      );
      // TODO: Update user in mailchimp if needed
      return {};
    } else {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You don't have permission to update this user"
      );
    }
  });

export const getUserById = functions
  .region(region)
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    functions.logger.debug("getUserById parameters", data);
    const uid = data.uid;
    const user = await admin.auth().getUser(uid);
    if (
      user &&
      (context.auth?.uid === uid ||
        context.auth?.token?.role === ROLE_ADMIN ||
        (context.auth?.token?.role === ROLE_CHAINADMIN &&
          context.auth.token?.chainId === user.customClaims?.chainId))
    ) {
      const userData = await db.collection("users").doc(uid).get();
      return {
        uid: user.uid,
        email: user.email,
        name: user.displayName,
        phoneNumber: user.phoneNumber,
        emailVerified: user.emailVerified,
        chainId: userData.get("chainId"),
        address: userData.get("address"),
        newsletter: userData.get("newsletter"),
        interestedSizes: userData.get("interestedSizes"),
        role: user.customClaims?.role,
      };
    } else {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You don't have permission to retrieve information about this user"
      );
    }
  });

export const getUserByEmail = functions
  .region(region)
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    functions.logger.debug("getUserByEmail parameters", data);
    const email = data.email;
    const user = await admin.auth().getUserByEmail(email);
    if (
      user &&
      (context.auth?.uid === user.uid ||
        context.auth?.token?.role === ROLE_ADMIN ||
        (context.auth?.token?.role === ROLE_CHAINADMIN &&
          context.auth.token?.chainId === user.customClaims?.chainId))
    ) {
      const userData = await db.collection("users").doc(user.uid).get();
      return {
        uid: user.uid,
        email: user.email,
        name: user.displayName,
        phoneNumber: user.phoneNumber,
        emailVerified: user.emailVerified,
        chainId: userData.get("chainId"),
        address: userData.get("address"),
        newsletter: userData.get("newsletter"),
        interestedSizes: userData.get("interestedSizes"),
        role: user.customClaims?.role,
      };
    } else {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You don't have permission to retrieve information about this user"
      );
    }
  });

export const contactMail = functions
  .region(region)
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    functions.logger.debug("contactMail parameters", data);

    const [name, email, message] = [data.name, data.email, data.message];

    // send user message to the clothing loop team
    await db.collection("mail").add({
      to: functions.config().clothingloop.contact_emails.split(";"),
      message: {
        subject: `ClothingLoop Contact Form - ${name}`,
        html: ` <h3>Name</h3>
                    <p>${name}</p>
                    <h3>Email</h3>
                    <p>${email}</p>
                    <h3>Message</h3>
                    <p>${message}</p>
            `,
      },
    });

    // send confirmation mail to the user
    await db.collection("mail").add({
      to: email,
      message: {
        subject: "Thank you for contacting Clothing-Loop",
        html: ` <p>Hi ${name},</p>
                    <p>Thank you for your message!</p>
                    <p>You wrote:</p>
                    <p>${message}</p>
                    <p>We will contact you as soon as possible.</p>
                    <p>Regards,</p>
                    <p>The clothing-loop team!</p>
            `,
      },
    });
  });

export const subscribeToNewsletter = functions
  .region(region)
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    functions.logger.debug("subscribeToNewsletter parameters", data);

    const {name, email} = data;

    await db.collection("interested_users").add({
      name,
      email,
    });

    await db.collection("mail").add({
      to: email,
      message: {
        subject: "Thank you for subscribing to Clothing Loop",
        html: ` <p>Hi ${name},</p>

                <p>Hurrah! You are now subscribed to our newsletter.</p>
                <p> Expect monthly updates full of inspiration, swap highlights and all kinds of wonderful Clothing Loop related stories.</p>
              
                <p>And please do reach out if you have exciting news or a nice Clothing Loop story you would like to share. We’d love to hear from you! <a href="mailto:hello@clothingloop.org">hello@clothingloop.org</a></p>
                
                <p>Changing the fashion world one swap at a time, let’s do it together!</p>
                
                <p>Thank you for your interest and support.</p>
                
               <p> Nichon, Paloeka, Giulia and Mirjam</p>
              `,
      },
    });
  });
