#!/usr/bin/env python3
import json
import os
import struct
import sys


def getMessage():
    rawLength = sys.stdin.buffer.read(4)
    if len(rawLength) == 0:
        sys.exit(0)
    messageLength = struct.unpack('@I', rawLength)[0]
    message = sys.stdin.buffer.read(messageLength).decode('utf-8')
    return json.loads(message)


def encodeMessage(messageContent):
    encodedContent = json.dumps(messageContent).encode('utf-8')
    encodedLength = struct.pack('@I', len(encodedContent))
    return {'length': encodedLength, 'content': encodedContent}


def sendMessage(encodedMessage):
    sys.stdout.buffer.write(encodedMessage['length'])
    sys.stdout.buffer.write(encodedMessage['content'])
    sys.stdout.buffer.flush()


def getOtpCode(key):
    result = run('ykman oath accounts code "{}"'.format(key))
    return result.strip().split(" ")[-1]


def handleGenerateOtpMessage(receivedMessage):

    responseMessage = {
        "type": "otpResponse",
        "target": receivedMessage["target"],
        "otp": getOtpCode(receivedMessage["keyName"]),
    }
    sendMessage(encodeMessage(responseMessage))


def run(command: str) -> str:
    """Runs a shell command and returns its output."""
    return os.popen(command).read()

def run2(command: str) -> str:
    import subprocess
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    return result.stdout

def getKeys() -> list:
    command = "ykman oath accounts list"
    output = run2(command)
    lines = output.splitlines()
    return lines


def returnList(receivedMessage):
    responseMessage = {
        "type": "keysListing",
        "list": getKeys()
    }
    sendMessage(encodeMessage(responseMessage))

while True:
    receivedMessage = getMessage()
    isGenerateOtp = receivedMessage.get("type") == "generateOtp"
    isFetchList = receivedMessage.get("type") == "fetchOtp"
    if isGenerateOtp:
        if "keyName" in receivedMessage:
            handleGenerateOtpMessage(receivedMessage)
        else:
                sendMessage(encodeMessage({"type": "otpNotFound", "target": receivedMessage["target"]}))
    if isFetchList:
        returnList(receivedMessage)
